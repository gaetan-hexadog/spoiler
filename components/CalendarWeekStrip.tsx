import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors } from '@/lib/theme';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * 2a — Bandeau semaine (mobile) : aperçu Lun→Dim au-dessus de l'agenda.
 * Jour actif en jaune, pastille sous les jours qui ont des sorties.
 * Tap un jour → scroll de la SectionList vers ce jour.
 *
 * `weekStart` = lundi de la semaine affichée (YYYY-MM-DD, cf. weekStartIso()).
 * `daysWithItems` = Set des dates (YYYY-MM-DD) ayant au moins un épisode.
 */
export function CalendarWeekStrip({
  weekStart,
  today,
  daysWithItems,
  selected,
  onSelect,
}: {
  weekStart: string;
  today: string;
  daysWithItems: Set<string>;
  selected: string;
  onSelect: (iso: string) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <View className="flex-row gap-1.5 px-3 pt-3 pb-1">
      {days.map((iso, i) => {
        const isToday = iso === today;
        const isSelected = iso === selected && !isToday;
        const has = daysWithItems.has(iso);
        const num = Number(iso.slice(8, 10));
        return (
          <Pressable
            key={iso}
            onPress={() => onSelect(iso)}
            className={`flex-1 items-center py-2 rounded-xl ${
              isToday ? 'bg-accent' : isSelected ? 'bg-surface' : ''
            }`}
          >
            <Text
              className={`text-[10px] font-bold ${
                isToday ? 'text-accent-fg' : 'text-muted'
              }`}
            >
              {WEEKDAYS[i]}
            </Text>
            <Text
              className={`text-[15px] font-extrabold mt-1 ${
                isToday ? 'text-accent-fg' : 'text-fg'
              }`}
            >
              {num}
            </Text>
            <View
              style={{
                width: 5,
                height: 5,
                borderRadius: 99,
                marginTop: 3,
                backgroundColor: has
                  ? isToday
                    ? colors.accentText
                    : colors.accent
                  : 'transparent',
              }}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
