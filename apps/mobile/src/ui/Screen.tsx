import { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from './theme';

export interface ScreenProps {
  children: ReactNode;
  /** Wrap content in a ScrollView (default). Disable for lists that scroll themselves. */
  scroll?: boolean;
  /** Avoid the keyboard — for forms. */
  keyboard?: boolean;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
  testID?: string;
}

/** Page scaffold: background, safe areas, gutters, optional scroll, pull-to-refresh and keyboard. */
export function Screen({
  children,
  scroll = true,
  keyboard = false,
  edges = ['top'],
  contentStyle,
  refreshing,
  onRefresh,
  footer,
  testID,
}: ScreenProps) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing ?? false}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.fill, contentStyle]}>{children}</View>
  );

  const inner = (
    <>
      {body}
      {footer && <View style={styles.footer}>{footer}</View>}
    </>
  );

  return (
    <SafeAreaView edges={edges} style={styles.screen} testID={testID}>
      {keyboard ? (
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, flexGrow: 1 },
  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg },
});
