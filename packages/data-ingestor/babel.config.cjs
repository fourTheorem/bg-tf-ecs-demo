module.exports = function configureBabel(api) {
  api.cache(true);

  const presets = [
    [
      '@babel/preset-env',
      {
        targets: {
          node: '18',
        },
      },
    ],
    [
      '@babel/preset-typescript',
    ],
  ];

  const plugins = ['@babel/plugin-syntax-top-level-await'];

  return {
    presets,
    plugins,
  };
};
