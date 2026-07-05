module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4 : le plugin worklets doit rester en dernier.
    plugins: ['react-native-worklets/plugin'],
  };
};
