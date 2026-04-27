import "./main.css";

import { around } from "monkey-around";
import {
  Editor,
  editorInfoField,
  type HoverParent,
  HoverPopover,
  Keymap,
  MarkdownRenderer,
  MarkdownView,
  Plugin,
  View,
  Workspace,
} from "obsidian";
import { BetterFnSettingTab, DEFAULT_SETTINGS } from "./settings";

import { type BridgeEl, PopoverHandler } from "./processor";
import { EditorView } from "@codemirror/view";
import {
  debugPopover,
  logDebugStatus,
  summarizeElement,
} from "./modules/debug";

type leafAction = Parameters<Workspace["iterateAllLeaves"]>[0];

type MarkdownViewModified = MarkdownView & {
  onUnloadFile_revert?: ReturnType<typeof around>;
};

/** check if given view's onload is intact */
const isIntact = (view: View): view is MarkdownView =>
  view instanceof MarkdownView &&
  (view as MarkdownViewModified).onUnloadFile_revert === undefined;
export default class BetterFn extends Plugin implements HoverParent {
  // settings: BetterFnSettings = DEFAULT_SETTINGS;

  PopoverHandler = PopoverHandler.bind(this);

  hoverPopover: HoverPopover | null = null;

  private editorHoverPopover: HoverPopover | null = null;

  private editorHoverTarget: HTMLElement | null = null;

  private editorHoverMark: string | null = null;

  settings = DEFAULT_SETTINGS;

  private isSameEditorHover(target: HTMLElement, mark: string): boolean {
    return (
      this.editorHoverPopover !== null &&
      this.editorHoverTarget === target &&
      this.editorHoverMark === mark
    );
  }

  private clearEditorHoverPopover(reason: string): void {
    const hoverPopover = this.editorHoverPopover;

    if (hoverPopover) {
      debugPopover("editor.hoverPopover.unload", { reason });
      hoverPopover.unload();
    }

    this.editorHoverPopover = null;
    this.editorHoverTarget = null;
    this.editorHoverMark = null;

    if (this.hoverPopover === hoverPopover) {
      this.hoverPopover = null;
    }
  }

  /** Remove redundant element from fnInfo */
  modifyOnUnloadFile: leafAction = (leaf) => {
    if (!isIntact(leaf.view)) return;
    const view = leaf.view;
    const revert = around(leaf.view, {
      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      onUnloadFile(next) {
        return function (this: any, ...args) {
          const bridgeEl = view.previewMode.containerEl.querySelector(
            ".markdown-preview-section",
          ) as BridgeEl;
          const { infoList, singleton } = bridgeEl;
          if (infoList) {
            infoList.forEach((info) => info.popover?.tippy.destroy());
            infoList.clear();
          }
          if (singleton) {
            singleton.destroy();
            bridgeEl.singleton = null;
          }
          return next.apply(this, args);
        };
      },
    });
    const mod = leaf.view as MarkdownViewModified;
    mod.onUnloadFile_revert = revert;
    this.register(() => {
      revert();
      delete mod.onUnloadFile_revert;
    });
  };

  clearInfoList: leafAction = (leaf) => {
    if (leaf.view instanceof MarkdownView) {
      const bridgeEl = leaf.view.previewMode.containerEl.querySelector(
        ".markdown-preview-section",
      ) as BridgeEl;
      const { infoList, singleton } = bridgeEl;
      if (infoList) {
        infoList.forEach((info) => info.popover?.tippy.destroy());
        delete bridgeEl.infoList;
      }
      if (singleton) {
        singleton.destroy();
        delete bridgeEl.singleton;
      }
    }
  };

  /** refresh opened MarkdownView */
  refresh: leafAction = (leaf) => {
    setTimeout(() => {
      if (leaf.view instanceof MarkdownView) {
        leaf.view.previewMode.rerender(true);
      }
    }, 200);
  };

  /** get the function that perform given actions on all leaves */
  getLoopAllLeavesFunc =
    (...actions: leafAction[]) =>
    () =>
      actions.forEach((action) => this.app.workspace.iterateAllLeaves(action));

  layoutChangeCallback = this.getLoopAllLeavesFunc(this.modifyOnUnloadFile);

  private extractFootnoteContent(content: string, mark: string): string {
    const targetFootnote = `[${mark}]:`;
    const start = content.indexOf(targetFootnote);

    if (start === -1) {
      return "";
    }

    const footnoteRegex = /^\[[^\]]+\]:/gm;
    footnoteRegex.lastIndex = start + targetFootnote.length;

    const match = footnoteRegex.exec(content);
    const end = match ? match.index : content.length;

    let footnoteContent = content.substring(start + targetFootnote.length, end);

    return footnoteContent
      .split("\n")
      .map((line) => line.trim())
      .join("\n");
  }

  initLivePreviewExtension = () => {
    this.registerEditorExtension(
      EditorView.domEventHandlers({
        mouseover: (e: MouseEvent, editorView: EditorView) => {
          if (Keymap.isModifier(e, "Mod")) {
            const target = e.target as HTMLElement;
            if (!target.hasClass("cm-footref")) {
              debugPopover("editor.mouseover.mod.nonFootref", {
                target: summarizeElement(e.target),
                relatedTarget: summarizeElement(e.relatedTarget),
              });
              return;
            }

            const field = editorView.state.field(editorInfoField);
            const editor: Editor = (field as any).editMode?.editor;

            const pos = editorView.posAtDOM(e.target as Node);
            const editorPos = editor.offsetToPos(pos);
            const editorLine = editor.getLine(editorPos.line);
            const startMarkIndex = editorLine.lastIndexOf("[", editorPos.ch);
            const endMarkIndex = editorLine.indexOf("]", editorPos.ch);
            const mark = editorLine.substring(startMarkIndex + 1, endMarkIndex);

            const content = editorView.state.doc.toString();
            const footnoteContent = this.extractFootnoteContent(content, mark);
            debugPopover("editor.footref.mouseover", {
              mark,
              pos,
              editorLine: editorPos.line,
              editorCh: editorPos.ch,
              footnoteContentLength: footnoteContent.length,
              target: summarizeElement(e.target),
              relatedTarget: summarizeElement(e.relatedTarget),
            });

            if (this.isSameEditorHover(target, mark)) {
              debugPopover("editor.hoverPopover.skipDuplicate", {
                mark,
                target: summarizeElement(target),
                relatedTarget: summarizeElement(e.relatedTarget),
              });
              return;
            }

            this.clearEditorHoverPopover("replace");

            const previousHoverPopover = this.hoverPopover;
            const hoverPopover = new HoverPopover(
              this,
              target,
              100,
            );
            debugPopover("editor.hoverPopover.created", {
              mark,
              reusedHoverParent: true,
              hadPreviousHoverPopover: previousHoverPopover !== null,
              target: summarizeElement(target),
            });

            this.hoverPopover = hoverPopover;
            this.editorHoverPopover = hoverPopover;
            this.editorHoverTarget = target;
            this.editorHoverMark = mark;
            hoverPopover.register(() => {
              if (this.editorHoverPopover === hoverPopover) {
                this.editorHoverPopover = null;
                this.editorHoverTarget = null;
                this.editorHoverMark = null;
              }

              if (this.hoverPopover === hoverPopover) {
                this.hoverPopover = null;
              }
            });
            hoverPopover.hoverEl.toggleClass("bn-hover-popover", true);
            const renderPromise = MarkdownRenderer.render(
              field.app,
              footnoteContent,
              hoverPopover.hoverEl,
              <string>field?.file?.path,
              hoverPopover,
            );
            void renderPromise.then(() => {
              debugPopover("editor.hoverPopover.rendered", {
                mark,
                internalLinks:
                  hoverPopover.hoverEl.querySelectorAll(".internal-link").length,
                hoverText: hoverPopover.hoverEl.textContent?.slice(0, 120),
              });
            });

            const embeds =
              hoverPopover.hoverEl?.querySelectorAll(".internal-link");
            embeds?.forEach((embed) => {
              const el = embed as HTMLAnchorElement;
              const href = el.getAttribute("data-href");
              if (!href) return;

              const destination = field.app.metadataCache.getFirstLinkpathDest(
                href,
                <string>field?.file?.path,
              );
              if (!destination) embed.classList.add("is-unresolved");

              this.registerDomEvent(el, "mouseover", (e) => {
                e.stopPropagation();
                field.app.workspace.trigger("hover-link", {
                  event: e,
                  source: "markdown",
                  hoverParent: hoverPopover.hoverEl,
                  targetEl: el,
                  linktext: href,
                  sourcePath: el.href,
                });
              });
            });
          }
        },
      }),
    );
  };

  override async onload() {
    console.log("loading BetterFn");

    await this.loadSettings();
    logDebugStatus();

    this.registerMarkdownPostProcessor(this.PopoverHandler);
    this.registerEvent(
      this.app.workspace.on("layout-change", this.layoutChangeCallback),
    );
    this.initLivePreviewExtension();
    this.getLoopAllLeavesFunc(this.modifyOnUnloadFile, this.refresh)();

    this.addSettingTab(new BetterFnSettingTab(this));
  }

  override onunload() {
    console.log("unloading BetterFn");

    this.clearEditorHoverPopover("plugin-unload");
    this.getLoopAllLeavesFunc(this.clearInfoList, this.refresh)();
  }

  async loadSettings() {
    this.settings = { ...this.settings, ...(await this.loadData()) };
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
