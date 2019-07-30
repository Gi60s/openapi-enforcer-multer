module.exports = {
  page: {
    layout: 'default',
    toc: true
  },
  site: {
    editSourceUrl: 'https://github.com/byu-oit/openapi-enforcer-multer/tree/master/docs-src',
    title: 'Open API Enforcer Multer',
    description: 'An Open API Enforcer plugin for multipart file uploads',
    url: 'https://byu-oit.github.io/openapi-enforcer-multer',
  },
  template: {
    path: 'default',
    cssFiles: [
      '/css/main.css'
    ],
    cssVars: {
      brandColor: '#2a7ae2',
      brandColorLight: '#85EA2D',
      brandColorDark: '#1D3949'
    },
    favicon: '/favicon.png',
    finePrint: '',
    footerLinks: [
      { title: 'Github', href: 'https://github.com/byu-oit/openapi-enforcer-multer' },
      { title: 'NPM', href: 'https://www.npmjs.com/package/openapi-enforcer-multer' }
    ]
  }
}
