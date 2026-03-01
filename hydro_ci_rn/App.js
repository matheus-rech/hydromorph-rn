/**
 * HydroMorph — Main App Entry Point
 * React Native (Expo) with React Navigation stack
 *
 * Screens:
 *   Upload     → Processing → Results
 *
 * Author: Matheus Machado Rech
 * License: Research use only — not for clinical diagnosis
 */

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

import UploadScreen     from './src/screens/UploadScreen';
import ProcessingScreen from './src/screens/ProcessingScreen';
import ResultsScreen    from './src/screens/ResultsScreen';
import { colors } from './src/theme';

const Stack = createStackNavigator();

// Navigation theme matching GitHub dark
const navTheme = {
  dark: true,
  colors: {
    primary:       colors.accent,
    background:    colors.bg,
    card:          colors.surface,
    text:          colors.text,
    border:        colors.border2,
    notification:  colors.red,
  },
};

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <NavigationContainer theme={navTheme}>
          <StatusBar style="light" backgroundColor={colors.bg} />
          <Stack.Navigator
            initialRouteName="Upload"
            screenOptions={{
              headerShown: false,
              cardStyle: { backgroundColor: colors.bg },
              animationEnabled: true,
              gestureEnabled: true,
            }}
          >
            <Stack.Screen
              name="Upload"
              component={UploadScreen}
              options={{ title: 'HydroMorph' }}
            />
            <Stack.Screen
              name="Processing"
              component={ProcessingScreen}
              options={{
                title: 'Processing…',
                gestureEnabled: false,  // prevent swipe-back during pipeline
              }}
            />
            <Stack.Screen
              name="Results"
              component={ResultsScreen}
              options={{ title: 'Results' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
