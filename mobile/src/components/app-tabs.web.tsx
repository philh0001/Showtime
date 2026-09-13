import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function AppTabs() {
  return (
    <Tabs style={styles.container}>
      <TabSlot style={styles.slot} />

      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>Home</TabButton>
          </TabTrigger>

          <TabTrigger name="search" href="/search" asChild>
            <TabButton>Search</TabButton>
          </TabTrigger>

          <TabTrigger name="watchlist" href="/watchlist" asChild>
            <TabButton>Watchlist</TabButton>
          </TabTrigger>

          <TabTrigger name="profile" href="/profile" asChild>
            <TabButton>Profile</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({
  children,
  isFocused,
  ...props
}: TabTriggerSlotProps) {
  return (
    <Pressable {...props} accessibilityRole="tab" accessibilityState={{ selected: isFocused }}
      style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
      <View style={[styles.tabButtonView, isFocused && styles.selected]}>
        <Text style={[styles.tabText, isFocused && styles.selectedText]}>
          {children}
        </Text>
      </View>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  return (
    <View {...props} style={styles.tabListContainer}>
      <View style={styles.innerContainer}>
        {props.children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0, backgroundColor: '#0B0B0F' },
  slot: { flex: 1, minHeight: 0 },
  tabListContainer: {
    width: '100%',
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    backgroundColor: '#16161B',
    borderTopColor: '#29292F',
    borderTopWidth: 1,
  },
  innerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    flexShrink: 1,
    maxWidth: 800,
    gap: 4,
  },
  tabButton: { flex: 1, minWidth: 0 },
  tabText: { color: '#A7A7B0', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  selected: { backgroundColor: '#29292F' },
  selectedText: { color: '#FFFFFF' },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 8,
    justifyContent: 'center',
  },
});
