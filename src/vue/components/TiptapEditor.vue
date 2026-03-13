<template>
  <div class="tiptap-editor" :class="{ 'is-not-editable': !editable }">
    <!-- 工具栏 -->
    <div v-if="showToolbar" class="tiptap-toolbar">
      <div class="toolbar-group">
        <!-- 文本格式 -->
        <button @click="editor?.chain().focus().toggleBold().run()" :class="{ 'is-active': editor?.isActive('bold') }"
                class="toolbar-btn" title="加粗">
          <span class="icon-bold">B</span>
        </button>
        <button @click="editor?.chain().focus().toggleItalic().run()"
                :class="{ 'is-active': editor?.isActive('italic') }" class="toolbar-btn" title="斜体">
          <span class="icon-italic">I</span>
        </button>
        <button @click="editor?.chain().focus().toggleUnderline().run()"
                :class="{ 'is-active': editor?.isActive('underline') }" class="toolbar-btn" title="下划线">
          <span class="icon-underline">U</span>
        </button>
        <button @click="editor?.chain().focus().toggleStrike().run()"
                :class="{ 'is-active': editor?.isActive('strike') }" class="toolbar-btn" title="删除线">
          <span class="icon-strike">S</span>
        </button>
      </div>

      <div class="toolbar-group">
        <!-- 颜色 -->
        <input type="color" @input="setTextColor" :value="getTextColor()" class="color-input" title="文字颜色"/>
        <input type="color" @input="setHighlightColor" :value="getHighlightColor()" class="color-input"
               title="背景颜色"/>
      </div>

      <div class="toolbar-group">
        <!-- 对齐 -->
        <button @click="editor?.chain().focus().setTextAlign('left').run()"
                :class="{ 'is-active': editor?.isActive({ textAlign: 'left' }) }" class="toolbar-btn" title="左对齐">
          <span class="icon-align-left">⬅</span>
        </button>
        <button @click="editor?.chain().focus().setTextAlign('center').run()"
                :class="{ 'is-active': editor?.isActive({ textAlign: 'center' }) }" class="toolbar-btn" title="居中">
          <span class="icon-align-center">↔</span>
        </button>
        <button @click="editor?.chain().focus().setTextAlign('right').run()"
                :class="{ 'is-active': editor?.isActive({ textAlign: 'right' }) }" class="toolbar-btn" title="右对齐">
          <span class="icon-align-right">➡</span>
        </button>
        <button @click="editor?.chain().focus().setTextAlign('justify').run()"
                :class="{ 'is-active': editor?.isActive({ textAlign: 'justify' }) }" class="toolbar-btn"
                title="两端对齐">
          <span class="icon-align-justify">⬌</span>
        </button>
      </div>

      <div class="toolbar-group">
        <!-- 标题 -->
        <select @change="setHeading" :value="getCurrentHeading()" class="heading-select">
          <option value="">正文</option>
          <option value="1">标题 1</option>
          <option value="2">标题 2</option>
          <option value="3">标题 3</option>
          <option value="4">标题 4</option>
          <option value="5">标题 5</option>
          <option value="6">标题 6</option>
        </select>
      </div>

      <div class="toolbar-group">
        <!-- 列表 -->
        <button @click="editor?.chain().focus().toggleBulletList().run()"
                :class="{ 'is-active': editor?.isActive('bulletList') }" class="toolbar-btn" title="无序列表">
          <span class="icon-bullet-list">•</span>
        </button>
        <button @click="editor?.chain().focus().toggleOrderedList().run()"
                :class="{ 'is-active': editor?.isActive('orderedList') }" class="toolbar-btn" title="有序列表">
          <span class="icon-ordered-list">1.</span>
        </button>
      </div>

      <div class="toolbar-group">
        <!-- 其他格式 -->
        <button @click="editor?.chain().focus().toggleBlockquote().run()"
                :class="{ 'is-active': editor?.isActive('blockquote') }" class="toolbar-btn" title="引用">
          <span class="icon-blockquote">"</span>
        </button>
        <button @click="editor?.chain().focus().toggleCodeBlock().run()"
                :class="{ 'is-active': editor?.isActive('codeBlock') }" class="toolbar-btn" title="代码块">
          <span class="icon-code-block">&lt;/&gt;</span>
        </button>
      </div>

      <div class="toolbar-group">
        <!-- 表格 -->
        <button @click="insertTable" class="toolbar-btn" title="插入表格">
          <span class="icon-table">⊞</span>
        </button>
      </div>

      <div class="toolbar-group">
        <!-- 历史操作 -->
        <button @click="editor?.chain().focus().undo().run()" :disabled="!editor?.can().undo()" class="toolbar-btn"
                title="撤销">
          <span class="icon-undo">↶</span>
        </button>
        <button @click="editor?.chain().focus().redo().run()" :disabled="!editor?.can().redo()" class="toolbar-btn"
                title="重做">
          <span class="icon-redo">↷</span>
        </button>
      </div>
    </div>

    <!-- 编辑器内容区域 -->
    <div class="tiptap-content">
      <editor-content :editor="editor" class="tiptap-editor-content"/>
    </div>

    <!-- 选中文本工具栏 -->
    <SelectionToolbarComponent
        v-if="editor && needSelectionToolbar" ref="selectionToolbarElement"
        v-model="showSelectionToolbar" :editor="editor" :left="selectionToolbarPosition.left"
        :top="selectionToolbarPosition.top" :from="selectionRange.from" :to="selectionRange.to"
        :selected-text="selectedText" :btns="props.btns" @add="handleAddClick"
        @note="handleNoteClick"
    />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, watch, nextTick, ref, computed } from "vue";
import { useEditor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import CodeBlock from "@tiptap/extension-code-block";
import Color from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import FontFamily from "@tiptap/extension-font-family";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import Highlight from "@tiptap/extension-highlight";
import CharacterCount from "@tiptap/extension-character-count";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import Image from "@tiptap/extension-image";
import Mermaid from "@/vue/extensions/Mermaid";
import StreamedContentMark from "@/vue/extensions/StreamedContentMark";
import StreamedContentActionBar from "@/vue/extensions/StreamedContentActionBar";
import HighlightMarker from "@/vue/extensions/HighlightMarker";
import SelectionToolbar from "@/vue/extensions/SelectionToolbar/index";
import SelectionToolbarComponent, {
  type SelectionToolBarAction
} from "@/vue/extensions/SelectionToolbar/SelectionToolbarComponent.vue";
import { type TiptapDocument } from "@/utils/mdConverter";
import { HIGHLIGHT_END, HIGHLIGHT_START } from "@/vue/utils/constant";

interface ActionBarHandlers {
  onEdit?: () => void;
  onRegenerate?: () => void;
  onReject?: () => void;
  onAccept?: (selectedOption?: "chapter" | "para" | "once") => void;
  onEditingCancel?: () => void;
  onEditingConfirm?: () => void;
}

// 选择工具栏按钮类型
export type SelectionToolbarButtonType = 'edit' | 'expand' | 'image' | 'add';

interface Props {
  modelValue: string | TiptapDocument;
  placeholder?: string;
  showToolbar?: boolean;
  editorKey?: number;
  needSelectionToolbar?: boolean;
  // useJsonFormat?: boolean
  modelType?: "json" | "html" | "md";
  disableSelection?: boolean; // 是否禁用文字选择
  actionBarHandlers?: ActionBarHandlers; // ActionBar 事件处理函数
  editable?: boolean; // 是否可编辑，默认为 true
  disableMermaid?: boolean; // 是否禁用 Mermaid 渲染，默认为 false
  btns?: SelectionToolBarAction[];
  // disabledToolbarButtons?: SelectionToolbarButtonType[]; // 禁用的工具栏按钮列表，默认为空数组（全部支持）
}

interface Emits {
  (e: "update:modelValue", value: string | TiptapDocument): void;

  (e: "change", value: string | TiptapDocument): void;

  (e: "streamed-content-edit"): void;

  (e: "streamed-content-regenerate"): void;

  (e: "streamed-content-reject"): void;

  (e: "streamed-content-accept", selectedOption?: "chapter" | "para" | "once"): void;

  (e: "selection-add", selectedText: string): void;

  (e: "selection-note", selectedText: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: "开始编写您的内容...",
  showToolbar: false,
  editorKey: 0,
  needSelectionToolbar: true,
  modelType: "md",
  disableSelection: false,
  editable: true,
  disableMermaid: false,
  btns: () => ['edit', 'expand', 'add', 'note'] as SelectionToolBarAction[], // 默认全部支持
});

const emit = defineEmits<Emits>();

// 标志位：防止循环更新
const isUpdatingFromExternal = ref(false);

// 选中文本工具栏元素引用
const selectionToolbarElement = ref<InstanceType<typeof SelectionToolbarComponent> | null>(null);
// 选中文本工具栏显示状态
const showSelectionToolbar = ref(false);
// 选中文本工具栏位置
const selectionToolbarPosition = ref({ left: 0, top: 0 });
// 选中文本的范围和内容
const selectionRange = ref({ from: 0, to: 0 });
const selectedText = ref("");

// 规范化初始内容
const getInitialContent = () => {
  if (!props.modelValue) {
    if (props.modelType === "json") {
      return { type: "doc", content: [] };
    }
    return "";
  }
  if (props.modelType === "json") {
    // 确保是有效的 JSON 格式
    if (typeof props.modelValue === "string") {
      try {
        return JSON.parse(props.modelValue);
      } catch {
        return { type: "doc", content: [] };
      }
    }
    return props.modelValue;
  }
  return props.modelValue;
};

// 根据 modelType 决定是否添加 Markdown 扩展
// 注意：Markdown 需要在 StarterKit 之前，Mermaid 必须在最前面
// 根据 disableMermaid 决定是否添加 Mermaid 扩展
const extensions = computed(() => {
  const exts: any[] = [];

  // 只有在不禁用 Mermaid 时才添加 Mermaid 扩展
  if (!props.disableMermaid) {
    exts.push(Mermaid);
  }

  // Markdown 插件（无条件添加，不会影响其他模式）
  exts.push(Markdown);

  // StarterKit
  exts.push(
      StarterKit.configure({
        // 排除 codeBlock，我们将单独配置它来排除 mermaid
        codeBlock: false,
      })
  );

  // 单独添加 codeBlock
  exts.push(
      CodeBlock.extend({
        parseHTML() {
          return [
            {
              tag: "pre",
              preserveWhitespace: "full",
              getAttrs: (node) => {
                if (typeof node === "string") return false;
                if (!(node instanceof HTMLElement)) return false;
                const codeElement = node.querySelector("code");
                // 如果禁用了 Mermaid，则将所有代码块（包括 mermaid）都作为普通代码块处理
                // 如果启用了 Mermaid，则排除 language-mermaid，让 Mermaid 扩展处理
                if (
                    !props.disableMermaid &&
                    codeElement &&
                    codeElement.classList.contains("language-mermaid")
                ) {
                  return false;
                }
                return {};
              },
            },
          ];
        },
      })
  );

  // 添加其他扩展
  exts.push(
      Color,
      FontFamily,
      Highlight.configure({
        multicolor: true,
      }),
      CharacterCount,
      TableRow,
      TableHeader,
      TableCell,
      Table.configure({
        resizable: true,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Placeholder.configure({
        placeholder: props.placeholder,
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      StreamedContentMark, // 添加流式内容 Mark 扩展
      HighlightMarker.configure({
        startMarker: HIGHLIGHT_START,
        endMarker: HIGHLIGHT_END,
      }),
      StreamedContentActionBar.configure({
        // 优先使用 props 中的处理函数（不再传递 range，由 WorkflowGenerate 内部维护）
        onEdit: () => {
          if (props.actionBarHandlers?.onEdit) {
            props.actionBarHandlers.onEdit();
          } else {
            emit("streamed-content-edit");
          }
        },
        onRegenerate: () => {
          if (props.actionBarHandlers?.onRegenerate) {
            props.actionBarHandlers.onRegenerate();
          } else {
            emit("streamed-content-regenerate");
          }
        },
        onReject: () => {
          if (props.actionBarHandlers?.onReject) {
            props.actionBarHandlers.onReject();
          } else {
            emit("streamed-content-reject");
          }
        },
        onAccept: (selectedOption) => {
          if (props.actionBarHandlers?.onAccept) {
            props.actionBarHandlers.onAccept(selectedOption);
          } else {
            emit("streamed-content-accept", selectedOption);
          }
        },
        onEditingCancel: () => {
          if (props.actionBarHandlers?.onEditingCancel) {
            props.actionBarHandlers.onEditingCancel();
          }
        },
        onEditingConfirm: () => {
          if (props.actionBarHandlers?.onEditingConfirm) {
            props.actionBarHandlers.onEditingConfirm();
          }
        },
      }), // 添加流式内容操作栏扩展
      // 添加 SelectionToolbar，使用 getter 函数动态获取 element
      SelectionToolbar.configure({
        getElement: () => {
          const toolbar = selectionToolbarElement.value;
          if (toolbar && toolbar.$el) {
            return toolbar.$el as HTMLElement;
          }
          return null;
        },
        setVisible: (visible: boolean) => {
          showSelectionToolbar.value = visible;
        },
        getVisible: () => {
          return showSelectionToolbar.value;
        },
        setPosition: (left: number, top: number) => {
          selectionToolbarPosition.value = { left, top };
        },
        setSelection: (from: number, to: number, text: string) => {
          selectionRange.value = { from, to };
          selectedText.value = text;
        },
      })
  );

  return exts;
});

const editor = useEditor({
  content: "",
  extensions: extensions.value,
  editable: props.editable, // 设置初始可编辑状态
  editorProps: {
    attributes: {
      class: "prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none",
      style: `min-height: 200px; padding: 20px; ${props.disableSelection
          ? "user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none;"
          : ""
      }`,
      "data-placeholder": props.placeholder,
    },
  },
  onUpdate: ({ editor }) => {
    // 如果正在从外部更新，不触发 model 更新，避免循环
    if (isUpdatingFromExternal.value) {
      return;
    }

    if (props.modelType === "json") {
      const json = editor.getJSON();
      emit("update:modelValue", json);
      emit("change", json);
    } else if (props.modelType === "md") {
      // 使用 Markdown 插件的方法获取 markdown 内容
      try {
        const markdownStorage = (editor.storage as any).markdown;
        if (markdownStorage && typeof markdownStorage.getMarkdown === "function") {
          const markdown = markdownStorage.getMarkdown();
          emit("update:modelValue", markdown);
          emit("change", markdown);
        } else {
          // 如果 Markdown 插件方法不可用，使用 HTML 作为后备
          const html = editor.getHTML();
          emit("update:modelValue", html);
          emit("change", html);
        }
      } catch (error) {
        console.error("Error getting markdown:", error);
        const html = editor.getHTML();
        emit("update:modelValue", html);
        emit("change", html);
      }
    } else {
      // modelType === 'html'
      const html = editor.getHTML();
      emit("update:modelValue", html);
      emit("change", html);
    }
  },
  onCreate: ({ editor }) => {
    // 调试：检查 Markdown 插件是否正确加载
    if (props.modelType === "md") {
      // 检查扩展列表
      const extensions = editor.extensionManager.extensions;
      const hasMarkdownExtension = extensions.some((ext) => ext.name === "markdown");
    }

    // 确保编辑器创建后内容正确
    if (props.modelValue) {
      if (props.modelType === "json") {
        // 将 Proxy 对象转换为纯对象
        const pureValue = JSON.parse(JSON.stringify(props.modelValue));
        editor.commands.setContent(pureValue as TiptapDocument);
      } else if (props.modelType === "md") {
        // 使用 Markdown 插件的方法设置 markdown 内容
        try {
          isUpdatingFromExternal.value = true;
          const markdownStorage = (editor.storage as any).markdown;
          if (markdownStorage && typeof markdownStorage.setMarkdown === "function") {
            markdownStorage.setMarkdown((props.modelValue as string) || "");
          } else {
            editor.commands.setContent(props.modelValue as string);
          }
        } catch (error) {
          console.error("Error setting markdown:", error);
          editor.commands.setContent(props.modelValue as string);
        } finally {
          setTimeout(() => {
            isUpdatingFromExternal.value = false;
          }, 0);
        }
      } else {
        // modelType === 'html'
        editor.commands.setContent(props.modelValue as string);
      }
    } else {
      if (props.modelType === "json") {
        editor.commands.setContent({ type: "doc", content: [] });
      } else {
        editor.commands.setContent("");
      }
    }
  },
});

// 监听 placeholder 变化，更新编辑器配置
watch(
    () => props.placeholder,
    (newPlaceholder) => {
      if (editor.value) {
        // 通过 setOptions 更新 Placeholder 扩展配置
        const currentExtensions = editor.value.extensionManager.extensions;
        const updatedExtensions = currentExtensions.map((ext) => {
          if (ext.name === "placeholder") {
            return Placeholder.configure({
              placeholder: newPlaceholder,
            });
          }
          return ext;
        });
        editor.value.setOptions({
          extensions: updatedExtensions,
        });
      }
    }
);

// 监听 editable 变化，动态更新编辑器可编辑状态
watch(
    () => props.editable,
    (newEditable) => {
      if (editor.value) {
        console.log(`[TiptapEditor] 更新编辑器可编辑状态: ${newEditable}`);
        editor.value.setEditable(newEditable);
      }
    },
    { immediate: false }
);

// 监听 disableMermaid 变化，需要重新创建编辑器以应用新的扩展配置
watch(
    () => props.disableMermaid,
    () => {
      // 当 disableMermaid 变化时，需要重新创建编辑器
      // 通过更新 editorKey 来触发重新创建（由父组件控制）
      // 这里我们只记录变化，实际重新创建由父组件通过 editorKey 控制
      console.log(`[TiptapEditor] disableMermaid changed: ${props.disableMermaid}`);
    }
);

// 监听外部内容变化
watch(
    () => props.modelValue,
    (newValue) => {
      if (!editor.value) return;

      try {
        if (props.modelType === "json") {
          const currentJson = editor.value.getJSON();
          // 将 Proxy 对象转换为纯对象
          const pureValue = JSON.parse(JSON.stringify(newValue));
          if (JSON.stringify(currentJson) !== JSON.stringify(pureValue)) {
            isUpdatingFromExternal.value = true;
            editor.value.commands.setContent(pureValue as TiptapDocument);
            setTimeout(() => {
              isUpdatingFromExternal.value = false;
            }, 0);
          }
        } else if (props.modelType === "md") {
          // 获取当前编辑器的 markdown 内容
          const markdownStorage = (editor.value.storage as any).markdown;
          const currentMarkdown = markdownStorage?.getMarkdown?.() || "";

          // 只有当内容真正改变时才更新
          if (currentMarkdown !== newValue) {
            // 设置标志位，防止触发 onUpdate
            isUpdatingFromExternal.value = true;

            try {
              // 使用 Markdown 插件的方法设置 markdown 内容
              if (markdownStorage && typeof markdownStorage.setMarkdown === "function") {
                markdownStorage.setMarkdown((newValue as string) || "");
              } else {
                // 如果 Markdown 插件方法不可用，回退到 setContent
                editor.value.commands.setContent(newValue as string);
              }
            } finally {
              // 使用 setTimeout 确保在下一个事件循环中重置标志位
              setTimeout(() => {
                isUpdatingFromExternal.value = false;
              }, 0);
            }
          }
        } else {
          // modelType === 'html'
          if (editor.value.getHTML() !== newValue) {
            isUpdatingFromExternal.value = true;
            editor.value.commands.setContent(newValue as string);
            setTimeout(() => {
              isUpdatingFromExternal.value = false;
            }, 0);
          }
        }
      } catch (error) {
        console.error("Error updating editor content:", error);
        try {
          isUpdatingFromExternal.value = true;
          editor.value.commands.setContent(newValue as string);
        } catch (e) {
          console.error("Error setting content:", e);
        } finally {
          setTimeout(() => {
            isUpdatingFromExternal.value = false;
          }, 0);
        }
      }
    },
    { immediate: false }
);

// 监听editorKey变化，强制重新渲染
watch(
    () => props.editorKey,
    () => {
      if (editor.value) {
        nextTick(() => {
          isUpdatingFromExternal.value = true;
          try {
            if (props.modelType === "json") {
              // 将 Proxy 对象转换为纯对象
              const pureValue = JSON.parse(JSON.stringify(props.modelValue));
              editor.value?.commands.setContent(pureValue as TiptapDocument);
            } else if (props.modelType === "md") {
              if (editor.value) {
                const markdownStorage = (editor.value.storage as any).markdown;
                if (markdownStorage && typeof markdownStorage.setMarkdown === "function") {
                  markdownStorage.setMarkdown((props.modelValue as string) || "");
                } else {
                  editor.value.commands.setContent(props.modelValue as string);
                }
              }
            } else {
              // modelType === 'html'
              editor.value?.commands.setContent(props.modelValue as string);
            }
          } catch (error) {
            console.error("Error setting content:", error);
            editor.value?.commands.setContent(props.modelValue as string);
          } finally {
            setTimeout(() => {
              isUpdatingFromExternal.value = false;
            }, 0);
          }
        });
      }
    }
);

// 工具栏功能函数
const setTextColor = (event: Event) => {
  const target = event.target as HTMLInputElement;
  editor.value?.chain().focus().setColor(target.value).run();
};

const setHighlightColor = (event: Event) => {
  const target = event.target as HTMLInputElement;
  editor.value?.chain().focus().toggleHighlight({ color: target.value }).run();
};

const getTextColor = () => {
  return editor.value?.getAttributes("textStyle").color || "#000000";
};

const getHighlightColor = () => {
  return editor.value?.getAttributes("highlight").color || "#ffff00";
};

const setHeading = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  const level = parseInt(target.value);
  if (level) {
    editor.value
        ?.chain()
        .focus()
        .toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 })
        .run();
  } else {
    editor.value?.chain().focus().setParagraph().run();
  }
};

const getCurrentHeading = () => {
  for (let i = 1; i <= 6; i++) {
    if (editor.value?.isActive("heading", { level: i as 1 | 2 | 3 | 4 | 5 | 6 })) {
      return i.toString();
    }
  }
  return "";
};

const insertTable = () => {
  editor.value?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
};

// 处理选中文本工具栏的 LOG 按钮点击
const handleAddClick = (selectedText: string) => {
  emit("selection-add", selectedText);
};

// 处理选中文本工具栏的笔记按钮点击
const handleNoteClick = (selectedText: string) => {
  emit("selection-note", selectedText);
};

// 设置编辑器文字是否可选择
const setSelectable = (selectable: boolean) => {
  if (!editor.value) return;

  const editorElement = editor?.value?.view?.dom as HTMLElement;
  if (editorElement) {
    if (selectable) {
      // 启用文字选择
      editorElement.style.userSelect = "";
      editorElement.style.webkitUserSelect = "";
      editorElement.style.removeProperty("-moz-user-select");
      editorElement.style.removeProperty("-ms-user-select");
      editorElement.style.cursor = "";
    } else {
      // 禁用文字选择
      editorElement.style.userSelect = "none";
      editorElement.style.webkitUserSelect = "none";
      editorElement.style.setProperty("-moz-user-select", "none");
      editorElement.style.setProperty("-ms-user-select", "none");
      editorElement.style.cursor = "default";
    }
  }
};

// 暴露编辑器实例给父组件
defineExpose({
  editor,
  getHTML: () => editor.value?.getHTML() || "",
  getText: () => editor.value?.getText() || "",
  setContent: (content: string) => editor.value?.commands.setContent(content),
  focus: () => editor.value?.commands.focus(),
  blur: () => editor.value?.commands.blur(),
  undo: () => editor.value?.commands.undo(),
  redo: () => editor.value?.commands.redo(),
  canUndo: () => editor.value?.can().undo() || false,
  canRedo: () => editor.value?.can().redo() || false,
  getCharacterCount: () => editor.value?.storage.characterCount.characters() || 0, // 字数统计方法
  getWordCount: () => editor.value?.storage.characterCount.words() || 0, // 单词数统计方法
  setSelectable, // 设置文字是否可选择

  setEditable: (editable: boolean) => {
    console.log(`[TiptapEditor] setEditable 被调用: ${editable}`);
    editor.value?.setEditable(editable);
  }, // 设置编辑器是否可编辑

  getContentRange: (text: string) => {
    if (!editor.value || !text || typeof text !== "string") {
      return { from: 0, to: 0 };
    }

    const doc = editor.value.state.doc;
    const originalSearchText = text.trim();

    // 规范化搜索文本：去除首尾空白，将多个空白字符（包括换行、制表符等）统一为单个空格
    const searchText = originalSearchText.replace(/\s+/g, " ");

    // 如果搜索文本为空，返回 {from: 0, to: 0}
    if (!searchText) {
      return { from: 0, to: 0 };
    }

    console.log("=== 开始匹配 ===");
    console.log("输入的搜索文本:", originalSearchText);
    console.log("规范化后的搜索文本:", searchText);

    // 重新设计：直接构建字符到文档位置的映射表
    interface CharPosition {
      char: string;
      docPos: number;
    }

    const charMap: CharPosition[] = [];
    let normalizedText = "";

    // 遍历文档，构建规范化文本和字符位置映射
    doc.descendants((node: any, pos: number) => {
      if (node.isText) {
        const nodeText = node.text || "";

        // 为每个字符建立映射，同时构建规范化文本
        let lastWasWhitespace = false;
        for (let i = 0; i < nodeText.length; i++) {
          const char = nodeText[i];
          const isWhitespace = /\s/.test(char);

          if (isWhitespace) {
            // 空白字符：只有在前一个字符不是空白字符时才添加
            if (!lastWasWhitespace) {
              charMap.push({
                char: " ",
                docPos: pos + i,
              });
              normalizedText += " ";
            }
            lastWasWhitespace = true;
          } else {
            // 非空白字符：直接添加
            charMap.push({
              char: char,
              docPos: pos + i,
            });
            normalizedText += char;
            lastWasWhitespace = false;
          }
        }
      }
      return true;
    });

    // 辅助函数：将规范化文本位置转换为文档位置
    const normalizedToDocPos = (
        normalizedStart: number,
        normalizedEnd: number
    ): { from: number; to: number } | null => {
      if (
          normalizedStart < 0 ||
          normalizedEnd < 0 ||
          normalizedStart >= normalizedEnd ||
          normalizedStart >= charMap.length
      ) {
        return null;
      }

      const from = charMap[normalizedStart]?.docPos;
      const to =
          normalizedEnd < charMap.length
              ? charMap[normalizedEnd]?.docPos
              : charMap[charMap.length - 1]?.docPos + 1;

      if (from === undefined || to === undefined) {
        return null;
      }

      return { from, to };
    };

    // 辅助函数：获取文档指定范围内的实际文本
    const getTextInRange = (from: number, to: number): string => {
      if (from < 0 || to < 0 || from >= to) {
        return "";
      }
      try {
        const range = { from, to };
        const selectedText = doc.textBetween(from, to);
        return selectedText.trim().replace(/\s+/g, " ");
      } catch (e) {
        return "";
      }
    };

    // 辅助函数：验证范围是否正确，如果不正确则调整偏移量
    const validateAndAdjustRange = (
        initialFrom: number,
        initialTo: number,
        maxAdjustments: number = 20
    ): { from: number; to: number } | null => {
      let from = initialFrom;
      let to = initialTo;
      let adjustments = 0;
      let bestMatch: { from: number; to: number; score: number } | null = null;

      // 尝试多个方向的调整
      const directions = [
        { fromDelta: 0, toDelta: 0 }, // 不调整
        { fromDelta: -1, toDelta: 0 }, // 起始向前
        { fromDelta: 1, toDelta: 0 }, // 起始向后
        { fromDelta: 0, toDelta: -1 }, // 结束向前
        { fromDelta: 0, toDelta: 1 }, // 结束向后
        { fromDelta: -1, toDelta: -1 }, // 两端都向前
        { fromDelta: 1, toDelta: 1 }, // 两端都向后
      ];

      while (adjustments < maxAdjustments) {
        // 获取当前范围内的实际文本
        const actualText = getTextInRange(from, to);
        const normalizedActualText = actualText.replace(/\s+/g, " ");

        // 比较规范化后的文本
        if (normalizedActualText === searchText) {
          // 完全匹配成功
          return { from, to };
        }

        // 计算相似度分数（用于找到最佳匹配）
        const similarity = calculateSimilarity(normalizedActualText, searchText);
        if (!bestMatch || similarity > bestMatch.score) {
          bestMatch = { from, to, score: similarity };
        }

        // 如果相似度很高（>0.9），认为已经足够接近
        if (similarity > 0.9) {
          return { from, to };
        }

        // 尝试不同方向的调整
        let adjusted = false;
        for (const dir of directions) {
          const newFrom = Math.max(0, from + dir.fromDelta);
          const newTo = Math.min(doc.content.size, to + dir.toDelta);

          if (newFrom < newTo) {
            const testText = getTextInRange(newFrom, newTo);
            const normalizedTestText = testText.replace(/\s+/g, " ");
            const testSimilarity = calculateSimilarity(normalizedTestText, searchText);

            if (testSimilarity > similarity) {
              from = newFrom;
              to = newTo;
              adjusted = true;
              break;
            }
          }
        }

        if (!adjusted) {
          // 如果没有找到更好的调整方向，尝试更大的步长
          const actualLength = normalizedActualText.length;
          const searchLength = searchText.length;
          const lengthDiff = actualLength - searchLength;

          if (Math.abs(lengthDiff) > 0) {
            if (lengthDiff > 0) {
              // 实际文本太长，缩小范围
              from = Math.max(0, from + Math.min(Math.floor(lengthDiff / 2), 3));
            } else {
              // 实际文本太短，扩大范围
              to = Math.min(
                  doc.content.size,
                  to + Math.min(Math.floor(Math.abs(lengthDiff) / 2), 3)
              );
            }
          } else {
            // 长度相同但内容不同，尝试微调
            break;
          }
        }

        adjustments++;
      }

      // 如果调整后仍然不匹配，返回最佳匹配
      if (bestMatch && bestMatch.score > 0.7) {
        return { from: bestMatch.from, to: bestMatch.to };
      }

      return null;
    };

    // 辅助函数：计算两个字符串的相似度（0-1之间）
    const calculateSimilarity = (str1: string, str2: string): number => {
      if (str1 === str2) return 1.0;
      if (str1.length === 0 || str2.length === 0) return 0.0;

      // 使用最长公共子序列（LCS）计算相似度
      const longer = str1.length > str2.length ? str1 : str2;
      const shorter = str1.length > str2.length ? str2 : str1;

      // 简单的字符匹配度
      let matches = 0;
      const minLength = Math.min(str1.length, str2.length);
      for (let i = 0; i < minLength; i++) {
        if (str1[i] === str2[i]) {
          matches++;
        }
      }

      // 计算前缀和后缀匹配度
      let prefixMatches = 0;
      for (let i = 0; i < Math.min(str1.length, str2.length); i++) {
        if (str1[i] === str2[i]) {
          prefixMatches++;
        } else {
          break;
        }
      }

      let suffixMatches = 0;
      for (let i = 0; i < Math.min(str1.length, str2.length); i++) {
        if (str1[str1.length - 1 - i] === str2[str2.length - 1 - i]) {
          suffixMatches++;
        } else {
          break;
        }
      }

      // 综合相似度：字符匹配度 + 前缀匹配度 + 后缀匹配度
      const charSimilarity = matches / longer.length;
      const prefixSimilarity = prefixMatches / Math.min(str1.length, str2.length);
      const suffixSimilarity = suffixMatches / Math.min(str1.length, str2.length);

      return charSimilarity * 0.5 + prefixSimilarity * 0.25 + suffixSimilarity * 0.25;
    };

    // 策略1：在规范化文本中查找匹配
    const matchIndex = normalizedText.indexOf(searchText);

    if (matchIndex === -1) {
      console.log("未找到匹配的文本");
      return { from: 0, to: 0 };
    }

    const matchEnd = matchIndex + searchText.length;
    console.log("在规范化文本中找到匹配，位置:", matchIndex, "到", matchEnd);

    // 转换为文档位置
    const docRange = normalizedToDocPos(matchIndex, matchEnd);
    if (!docRange) {
      console.log("无法转换为文档位置");
      return { from: 0, to: 0 };
    }

    console.log("转换后的文档位置:", docRange);

    // 验证返回的范围是否正确
    const actualText = getTextInRange(docRange.from, docRange.to);
    const normalizedActualText = actualText.replace(/\s+/g, " ");

    console.log("实际选中的文本:", actualText);
    console.log("规范化后的实际文本:", normalizedActualText);
    console.log("是否匹配:", normalizedActualText === searchText);

    if (normalizedActualText === searchText) {
      console.log("=== 匹配成功 ===");
      return docRange;
    }

    // 如果不匹配，尝试调整
    console.log("=== 文本不匹配，尝试调整 ===");
    const adjustedRange = validateAndAdjustRange(docRange.from, docRange.to);

    if (adjustedRange) {
      const adjustedText = getTextInRange(adjustedRange.from, adjustedRange.to);
      const normalizedAdjustedText = adjustedText.replace(/\s+/g, " ");
      console.log("调整后的范围:", adjustedRange);
      console.log("调整后选中的文本:", adjustedText);
      console.log("规范化后的调整文本:", normalizedAdjustedText);
      console.log("调整后是否匹配:", normalizedAdjustedText === searchText);

      if (normalizedAdjustedText === searchText) {
        console.log("=== 调整后匹配成功 ===");
        return adjustedRange;
      }
    }

    console.log("=== 匹配失败 ===");
    return { from: 0, to: 0 };
  },
});

onBeforeUnmount(() => {
  editor.value?.destroy();
});
</script>

<style scoped lang="less">
.tiptap-editor {
  // min-height: 100%;
  display: flex;
  flex-direction: column;
  color: var(--text-editor);
  position: relative; // 为 SelectionToolbar 提供定位上下文

  /* 不可编辑状态下的禁用光标 */

  &.is-not-editable {
    cursor: not-allowed;

    :deep(.ProseMirror) {
      cursor: not-allowed;
    }
  }
}

.tiptap-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  border-radius: 8px 8px 0 0;
}

.toolbar-group {
  display: flex;
  gap: 4px;
  align-items: center;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid #dee2e6;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  transition: all 0.2s;
}

.toolbar-btn:hover {
  background: #e9ecef;
  border-color: #adb5bd;
}

.toolbar-btn.is-active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.toolbar-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.color-input {
  width: 32px;
  height: 32px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
}

.heading-select {
  height: 32px;
  padding: 0 8px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background: white;
  font-size: 14px;
  cursor: pointer;
}

.tiptap-content {
  flex: 1;
  overflow: hidden;

  /* 禁用文字选择时的样式 */

  &.disable-selection {
    :deep(.ProseMirror) {
      user-select: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      cursor: default;
      /* 显示默认光标而不是文本选择光标 */
    }
  }
}

.tiptap-editor-content {
  overflow-y: auto;
  overflow-x: hidden;
  scroll-padding-bottom: 1em;
}

/* 编辑器内容样式 */
.tiptap-content :deep(.ProseMirror) {
  height: 100%;
  outline: none;
  padding: 20px;
  padding-top: 8px !important;

  /* 段落样式 */

  p {
    margin: 0.5em 0;

    /* 当编辑器为空且只有一个空段落时 */

    &:first-child {
      &.is-editor-empty.is-empty {
        text-indent: 0 !important;

        &:before {
          content: attr(data-placeholder);
          float: left;
          color: #adb5bd;
          pointer-events: none;
          height: 0;
        }
      }
    }
  }

  /* 标题样式 */

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin: 0.5em 0;
    font-weight: bold;
  }

  h1 {
    font-size: 2em;
  }

  h2 {
    font-size: 1.5em;
  }

  h3 {
    font-size: 1.25em;
  }

  h4 {
    font-size: 1.1em;
  }

  h5 {
    font-size: 1em;
  }

  h6 {
    font-size: 0.9em;
  }

  /* 列表样式 */

  ul,
  ol {
    padding-left: 2em;
    margin: 0.5em 0;

    li {
      margin: 0.25em 0;

      p {
        text-indent: 0 !important;
      }
    }
  }

  ul {
    list-style: disc;
  }

  ol {
    list-style: decimal;
  }

  /* 引用样式 */

  blockquote {
    border-left: 4px solid #e9ecef;
    padding-left: 1em;
    margin: 1em 0;
    color: #6c757d;
    font-style: italic;
  }

  /* 代码样式 */

  code {
    background: #f8f9fa;
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-size: 0.9em;
  }

  pre {
    background: #f8f9fa;
    padding: 1em;
    border-radius: 4px;
    overflow-x: auto;
    margin: 1em 0;

    code {
      background: none;
      padding: 0;
    }
  }

  /* 表格样式 */

  table {
    border-collapse: collapse;
    margin: 1em 0;
    width: 100%;

    tbody {
      td {
        border: 1px solid #dee2e6;
        padding: 0.5em;
        text-align: left;

        p {
          text-indent: 0 !important;
        }
      }
    }

    th {
      border: 1px solid #dee2e6;
      padding: 0.5em;
      text-align: left;
      background: #f8f9fa;
      font-weight: bold;
    }

    td {
      border: 1px solid #dee2e6;
      padding: 0.5em;
      text-align: left;
    }
  }

  strong {
    font-weight: 600;
  }

  a {
    color: var(--theme-color);
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }
}

/* 预览容器被移除，NodeView 直接渲染在文档流中 */
.mermaid-container {
  margin: 8px 0;
}

/* 流式内容高亮样式 */
:deep(.streamed-content) {
  background-color: #e6ffe6;
  /* 浅绿色背景 */
  color: #666;
  /* 浅灰色文字 */
  padding: 0 2px;
  /* 小间距 */
  transition: all 0.3s ease;
}

/* 流式内容激活状态（显示下划线） */
:deep(.streamed-content-active) {
  text-decoration: underline;
  text-decoration-color: #8b4513;
  /* 暗红色下划线 */
  text-decoration-thickness: 2px;
  text-underline-offset: 2px;
}
</style>
