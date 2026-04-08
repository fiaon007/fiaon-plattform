/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies cause TDZ issues in Safari',
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: 'no-lib-to-components',
      severity: 'error', 
      comment: 'lib/** must not import from components/**',
      from: {
        path: '^client/src/lib/',
      },
      to: {
        path: '^client/src/components/',
      },
    },
  ],
  options: {
    doNotFollow: {
      path: ['node_modules', 'dist', '.git'],
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: './tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
      mainFields: ['module', 'main', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules/(@[^/]+/[^/]+|[^/]+)',
      },
      text: {
        highlightFocused: true,
      },
    },
  },
};
