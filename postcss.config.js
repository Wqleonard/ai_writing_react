/**
 * PostCSS 配置文件
 * 用于自动将 px 转换为 rem
 *
 * PC 端：设计稿 1920px，基准 font-size 16px
 * 移动端：设计稿 400px，基准 font-size 16px
 *
 * 注意：rootValue 设置为 16，因为 PC 端和移动端都使用 16px 作为基准字体大小
 */

export default {
  plugins: {
    'postcss-pxtorem': {
      rootValue({ file }) {
        return 16;
      }, // 根字体大小，设计稿 1920px 时 font-size 为 16px
      unitPrecision: 5, // rem 的小数精度
      propList: ['*'],
      selectorBlackList: [
        '.ignore',
        '.page-agreement',
        '.hairlines',
        '.vue-flow-',
        '.vue-flow-card',
        // 排除 VueFlow 容器内的所有内容，匹配包含 vue-flow-card 的所有选择器
        /\.vue-flow-card/,
        /\.vue-flow-container\s+\.vue-flow-card/,
        /\.vue-flow-card\s+/,
      ], // 忽略的选择器，排除 VueFlow 容器内的所有内容
      replace: true, // 是否替换而不是添加
      mediaQuery: false, // 是否在媒体查询中转换 px
      minPixelValue: 1, // 小于这个值的 px 不转换（常用于处理 1px 边框）
      // 排除第三方库
      exclude: (file) => {
        // 排除所有 node_modules
        if (file.includes('node_modules')) {
          return true
        }
        // 特别排除 @nuxt/ui 相关文件
        // if (file.includes('@nuxt/ui') || file.includes('@nuxt/ui-pro')) {
        //   return true
        // }
        return false
      },
    },
  },
}

