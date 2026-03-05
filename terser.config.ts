// terser.config.ts
// Terser 配置选项
const terserConfig = {
  // 压缩选项
  compress: {
    // 基本压缩
    defaults: true,

    // 删除未使用的代码
    dead_code: true,
    unused: true,

    // 删除调试代码
    drop_console: true,
    drop_debugger: true,

    // 优化
    booleans_as_integers: false,
    collapse_vars: true,
    comparisons: true,
    computed_props: true,
    conditionals: true,
    evaluate: true,
    hoist_funs: true,
    hoist_props: true,
    hoist_vars: false,
    if_return: true,
    inline: true,
    join_vars: true,
    keep_classnames: true, // 保留类名，避免破坏 mermaid 等库
    keep_fargs: true,      // 保留函数参数名
    keep_fnames: true,    // 保留函数名，避免破坏 mermaid 等库
    keep_infinity: true,   // 保留 Infinity
    loops: true,
    negate_iife: true,
    properties: true,
    reduce_funcs: true,
    reduce_vars: true,
    sequences: true,
    side_effects: true,
    switches: true,
    toplevel: true,
    typeofs: true,

    // 高级压缩
    passes: 1, // 单次压缩以均衡速度
    pure_getters: false, // 设置为 false，避免破坏对象属性访问
    unsafe: false, // 设置为 false，避免不安全的优化
    unsafe_arrows: false,
    unsafe_comps: false,
    unsafe_math: false,
    unsafe_methods: false,
    unsafe_proto: false,
    unsafe_regexp: false,
    unsafe_undefined: false,
  },

  // 混淆选项
  mangle: {
    // 启用变量名混淆
    eval: true,
    keep_classnames: true,  // 保留类名，避免破坏 mermaid 等库
    keep_fnames: true,      // 保留函数名，避免破坏 mermaid 等库

    // 混淆属性名（可选，可能破坏代码）
    properties: false,      // 不混淆属性名，避免破坏对象属性访问

    // 排除特定名称
    reserved: [
      // 保留的关键字
      '$', '_', 'exports', 'module', 'require',
      'console', 'window', 'document', 'navigator',

      // 保留框架特定名称
      'Vue', 'React', 'Component', 'Prop', 'Emit',

      // 保留你的特定变量
      'init', 'render', 'update', 'destroy',

      // 保留 mermaid 相关属性
      'mermaid', 'order', 'config', 'initialize', 'render',
      'flowchart', 'graph', 'diagram', 'parse', 'parseError'
    ],

    // 混淆选项
    toplevel: true,    // 混淆顶级变量
    safari10: true,    // Safari 10 兼容
  },

  // 输出格式
  format: {
    comments: false,    // 删除注释
    beautify: false,    // 不美化
    indent_level: 0,    // 无缩进
    quote_style: 3,     // 始终使用双引号
    preserve_annotations: false,
    semicolons: true,

    // 高级格式化
    ascii_only: true,   // 只使用 ASCII 字符
    max_line_len: 80,
    braces: true,
  },
};

export default terserConfig;
