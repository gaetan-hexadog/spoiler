import React from 'react';
import { Image, Text, View } from 'react-native';

/** Logo PopcornLog : les barres « texte masqué » + le wordmark. */
export function Logo() {
  return (
    <View className="items-center gap-4">
      <Image
        source={require('../assets/logo.png')}
        style={{ width: 76, height: 49 }}
        resizeMode="contain"
      />
      <Text className="text-fg text-[30px] font-extrabold text-center">
        PopcornLog
      </Text>
    </View>
  );
}
