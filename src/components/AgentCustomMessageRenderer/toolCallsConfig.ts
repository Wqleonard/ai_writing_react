/**
 * 与 Vue AgentCustomMessageRenderer.vue 的 toolCallsActiveObject 一致，
 * 各 ToolCallsKey 的 name / default_splice_value / need_show / is_expend / output 等控制展示效果。
 */
export type ToolCallsKey =
  | "ls"
  | "read_file"
  | "write_file"
  | "edit_file"
  | "think_tool"
  | "word_count_tool"
  | "keyword_search_tool"
  | "knowledge_search_tool"
  | "internet_search_tool"
  | "write_todos"
  | "task"
  | "novel_deconstruct_tool"
  | "url_content_parser_tool"
  | "novel_inspiration_tool";

export interface ToolCallsValueItemOutput {
  is_expend: boolean;
  default_result_value?: string;
}

export interface ToolCallsValueItemInput {
  name: string;
  default_splice_value: string;
  file_path: boolean;
  is_expend: boolean;
  keyword: boolean;
  file_type: boolean;
  query: boolean;
  subagent_type: boolean;
  need_show: string[];
}

export interface ToolCallsValue {
  input?: ToolCallsValueItemInput;
  output?: ToolCallsValueItemOutput;
}

export const toolCallsActiveObject: Record<ToolCallsKey, ToolCallsValue> = {
  ls: {
    input: {
      name: "正在查看当前文件列表",
      file_path: false,
      is_expend: false,
      keyword: false,
      file_type: false,
      query: false,
      subagent_type: false,
      need_show: [],
      default_splice_value: "",
    },
  },
  read_file: {
    input: {
      name: "正在读取",
      file_path: true,
      is_expend: false,
      keyword: false,
      file_type: false,
      query: false,
      subagent_type: false,
      default_splice_value: "",
      need_show: [],
    },
  },
  write_file: {
    input: {
      name: "正在写入",
      file_path: true,
      is_expend: true,
      keyword: false,
      file_type: false,
      query: false,
      subagent_type: false,
      default_splice_value: "",
      need_show: ["content"],
    },
  },
  edit_file: {
    input: {
      name: "正在修改",
      file_path: true,
      is_expend: true,
      keyword: false,
      file_type: false,
      query: false,
      subagent_type: false,
      default_splice_value: "",
      need_show: ["old_string", "new_string"],
    },
  },
  think_tool: {
    input: {
      name: "正在思考",
      file_path: false,
      is_expend: true,
      keyword: false,
      file_type: false,
      query: false,
      subagent_type: false,
      default_splice_value: "",
      need_show: ["thoughts"],
    },
  },
  word_count_tool: {
    input: {
      name: "正在统计字数",
      file_path: true,
      is_expend: false,
      keyword: false,
      file_type: false,
      query: false,
      subagent_type: false,
      default_splice_value: "",
      need_show: [],
    },
    output: { is_expend: false },
  },
  keyword_search_tool: {
    input: {
      name: "正在全文搜索关键词",
      file_path: false,
      is_expend: false,
      keyword: true,
      file_type: false,
      query: false,
      subagent_type: false,
      default_splice_value: "",
      need_show: [],
    },
  },
  knowledge_search_tool: {
    input: {
      name: "正在查找",
      file_path: false,
      is_expend: false,
      keyword: false,
      file_type: false,
      query: true,
      subagent_type: false,
      default_splice_value: "",
      need_show: [],
    },
  },
  internet_search_tool: {
    input: {
      name: "正在联网调研",
      file_path: false,
      is_expend: false,
      keyword: false,
      file_type: false,
      query: true,
      subagent_type: false,
      default_splice_value: "",
      need_show: [],
    },
    output: { is_expend: true },
  },
  write_todos: {
    input: {
      name: "正在为您生成任务计划",
      file_path: false,
      is_expend: true,
      keyword: false,
      file_type: false,
      query: false,
      subagent_type: false,
      default_splice_value: "",
      need_show: [],
    },
  },
  task: {
    input: {
      name: "正在执行",
      file_path: false,
      is_expend: false,
      keyword: false,
      file_type: false,
      query: false,
      subagent_type: true,
      need_show: [],
      default_splice_value: "子任务",
    },
  },
  novel_deconstruct_tool: {
    input: {
      name: "正在大力拆书，请稍后",
      file_path: false,
      is_expend: false,
      keyword: false,
      file_type: false,
      query: false,
      subagent_type: false,
      default_splice_value: "",
      need_show: [],
    },
    output: { is_expend: false, default_result_value: "已更新到文档中" },
  },
  url_content_parser_tool: {
    input: {
      name: "正在读取您上传的文件，请稍候",
      file_path: false,
      is_expend: false,
      keyword: false,
      file_type: false,
      query: false,
      subagent_type: false,
      default_splice_value: "",
      need_show: [],
    },
  },
  novel_inspiration_tool: {
    input: {
      name: "正在汇集灵感...",
      file_path: false,
      is_expend: false,
      keyword: false,
      file_type: false,
      query: false,
      subagent_type: false,
      need_show: [],
      default_splice_value: "",
    },
  },
};
