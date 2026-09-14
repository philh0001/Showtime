import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  formatUkDate,
  getCountdownLabel,
  getDeviceLocalIsoDate,
  getSeasonAirDateLabel,
} from '@/services/air-date-rules';
import type { MediaDetails } from '@/services/details';
import {
  calculateEpisodeProgress,
  calculateTvProgress,
  commitTvProgressChange,
  deriveEpisodeMetadata,
  deriveTrackableSeasonNumbers,
  findEpisodeProgress,
  findTvProgress,
  setAiredEpisodesWatched,
  setEpisodeWatched,
  setSeasonWatched,
  type TvProgress,
} from '@/services/tv-progress-rules';
import {
  setTvAiredEpisodesWatched,
  setTvEpisodeWatched,
  setTvSeasonWatched,
  synchronizeTvTracking,
} from '@/services/tv-progress';
import { createRecentlyViewedSnapshot } from '@/services/recently-viewed-rules';
import { recordViewingActivity } from '@/services/viewing-activity';
import type { ViewingAction } from '@/services/viewing-activity-rules';
import { useTheme } from '@/hooks/use-theme';
import {
  canToggleEpisodeExpansion,
  getInitialEpisodeExpansion,
} from '@/services/tv-tracking-layout-rules';

type TrackingState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'ready'; records: TvProgress[] };

export function TvTrackingSection({ details }: { details: MediaDetails }) {
  const styles = createStyles(useTheme());
  const episodeCount = details.latestSeason?.episodes.length ?? 0;
  const canToggleEpisodes = canToggleEpisodeExpansion(episodeCount);
  const [episodesExpanded, setEpisodesExpanded] = useState(
    () => getInitialEpisodeExpansion(episodeCount),
  );
  const [tracking, setTracking] = useState<TrackingState>({ status: 'loading' });
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const busy = useRef(false);
  const todayIso = getDeviceLocalIsoDate();
  const trackableSeasons = useMemo(
    () => deriveTrackableSeasonNumbers(details.seasons, todayIso),
    [details.seasons, todayIso],
  );
  const latestEpisodeMetadata = useMemo(
    () => details.latestSeason?.episodes.length
      ? deriveEpisodeMetadata(
        details.latestSeason.seasonNumber,
        details.latestSeason.episodes,
        todayIso,
      )
      : null,
    [details.latestSeason, todayIso],
  );

  useEffect(() => {
    let active = true;
    synchronizeTvTracking(details.id, trackableSeasons, latestEpisodeMetadata)
      .then((records) => {
        if (active) setTracking({ status: 'ready', records });
      })
      .catch(() => {
        if (active) setTracking({ status: 'unavailable' });
      });
    return () => {
      active = false;
    };
  }, [details.id, latestEpisodeMetadata, trackableSeasons]);

  const progress = tracking.status === 'ready'
    ? findTvProgress(tracking.records, details.id)
    : null;
  const total = progress ? calculateTvProgress(progress) : null;
  const latestEpisodeProgress = details.latestSeason && progress
    ? findEpisodeProgress(progress, details.latestSeason.seasonNumber)
    : null;

  async function saveChange(
    key: string,
    optimistic: TvProgress[],
    write: () => Promise<TvProgress[]>,
    errorMessage: string,
    action: ViewingAction,
  ) {
    if (tracking.status !== 'ready' || busy.current) return;
    busy.current = true;
    const previous = tracking.records;
    setTracking({ status: 'ready', records: optimistic });
    setSavingKey(key);
    setTrackingError(null);
    const outcome = await commitTvProgressChange(previous, write);
    setTracking({ status: 'ready', records: outcome.records });
    if (!outcome.saved) setTrackingError(errorMessage);
    else {
      try { await recordViewingActivity(createRecentlyViewedSnapshot(details), action); }
      catch { setTrackingError('Progress saved, but viewing history could not be updated.'); }
    }
    busy.current = false;
    setSavingKey(null);
  }

  function toggleSeason(seasonNumber: number, watched: boolean) {
    if (tracking.status !== 'ready') return;
    void saveChange(
      `season-${seasonNumber}`,
      setSeasonWatched(tracking.records, details.id, seasonNumber, watched),
      () => setTvSeasonWatched(details.id, seasonNumber, watched),
      'Could not save season progress. Please try again.',
      { kind: 'season', seasonNumber, watched },
    );
  }

  function toggleEpisode(seasonNumber: number, episodeNumber: number, watched: boolean) {
    if (tracking.status !== 'ready') return;
    void saveChange(
      `episode-${seasonNumber}-${episodeNumber}`,
      setEpisodeWatched(tracking.records, details.id, seasonNumber, episodeNumber, watched),
      () => setTvEpisodeWatched(details.id, seasonNumber, episodeNumber, watched),
      'Could not save episode progress. Please try again.',
      { kind: 'episode', seasonNumber, episodeNumber, watched },
    );
  }

  function toggleAiredEpisodes(seasonNumber: number, watched: boolean) {
    if (tracking.status !== 'ready') return;
    const current = findTvProgress(tracking.records, details.id);
    const episodeProgress = current && findEpisodeProgress(current, seasonNumber);
    const episodeNumbers = episodeProgress?.trackableEpisodeNumbers.filter((number) =>
      episodeProgress.watchedEpisodeNumbers.includes(number) !== watched) ?? [];
    if (episodeNumbers.length === 0) return;
    void saveChange(
      `season-episodes-${seasonNumber}`,
      setAiredEpisodesWatched(tracking.records, details.id, seasonNumber, watched),
      () => setTvAiredEpisodesWatched(details.id, seasonNumber, watched),
      'Could not save episode progress. Please try again.',
      { kind: 'aired', seasonNumber, episodeNumbers, watched },
    );
  }

  const seasonsNewestFirst = [...details.seasons].sort(
    (a, b) => b.seasonNumber - a.seasonNumber,
  );

  return (
    <View>
      <Text accessibilityRole="header" style={styles.heading}>Next episode</Text>
      <View style={styles.nextEpisode}>
        {details.nextEpisode ? <>
          <Text style={styles.seasonTitle}>
            S{details.nextEpisode.seasonNumber} E{details.nextEpisode.episodeNumber}
            {details.nextEpisode.name ? ` · ${details.nextEpisode.name}` : ''}
          </Text>
          <Text style={styles.secondary}>
            {formatUkDate(details.nextEpisode.airDate)} · {getCountdownLabel(details.nextEpisode.airDate, todayIso)}
          </Text>
        </> : <Text style={styles.body}>No upcoming episode announced</Text>}
      </View>

      <Text accessibilityRole="header" style={styles.heading}>Seasons</Text>
      {tracking.status === 'loading' && <Text style={styles.secondary}>Loading progress…</Text>}
      {tracking.status === 'unavailable' && <Text accessibilityRole="alert" style={styles.error}>
        TV tracking is temporarily unavailable.
      </Text>}
      {total && <Text style={styles.progressText}>{total.watched} of {total.total} seasons watched</Text>}
      {trackingError && <Text accessibilityRole="alert" style={styles.error}>{trackingError}</Text>}

      {seasonsNewestFirst.length ? seasonsNewestFirst.map((season) => {
        const isLatest = details.latestSeason?.seasonNumber === season.seasonNumber;
        const hasEpisodeDetails = isLatest && details.latestSeason!.episodes.length > 0;
        const trackable = trackableSeasons.includes(season.seasonNumber);
        const watched = progress?.watchedSeasonNumbers.includes(season.seasonNumber) ?? false;
        const seasonSaving = savingKey === `season-${season.seasonNumber}`;
        const episodeTotal = hasEpisodeDetails && latestEpisodeProgress
          ? calculateEpisodeProgress(latestEpisodeProgress)
          : null;
        const allAiredWatched = episodeTotal !== null
          && episodeTotal.total > 0
          && episodeTotal.watched === episodeTotal.total;

        return (
          <View key={season.id} style={[styles.season, isLatest && styles.latestSeason]}>
            <View style={styles.seasonHeader}>
              <View style={styles.seasonText}>
                <View style={styles.titleRow}>
                  <Text style={styles.seasonTitle}>{season.name}</Text>
                  {isLatest && <Text style={styles.latestBadge}>Latest season</Text>}
                </View>
                <Text style={styles.secondary}>
                  {season.episodeCount === null
                    ? 'Episode count unknown'
                    : `${season.episodeCount} episode${season.episodeCount === 1 ? '' : 's'}`}
                  {' · '}{getSeasonAirDateLabel(season.airDate, todayIso)}
                </Text>
                {episodeTotal && <Text style={styles.episodeProgress}>
                  {episodeTotal.watched} of {episodeTotal.total} aired episodes watched
                </Text>}
              </View>
              {season.seasonNumber === 0
                ? <Text style={styles.untracked}>Not tracked</Text>
                : hasEpisodeDetails
                  ? episodeTotal && episodeTotal.total > 0
                    ? <ProgressButton
                      label={allAiredWatched ? 'Clear aired' : 'Mark aired watched'}
                      selected={allAiredWatched}
                      saving={savingKey === `season-episodes-${season.seasonNumber}`}
                      disabled={savingKey !== null || tracking.status !== 'ready'}
                      onPress={() => toggleAiredEpisodes(season.seasonNumber, !allAiredWatched)}
                    />
                    : <Text style={styles.untracked}>No episodes aired</Text>
                  : trackable
                    ? <ProgressButton
                      label={watched ? 'Watched' : 'Mark watched'}
                      selected={watched}
                      saving={seasonSaving}
                      disabled={savingKey !== null || tracking.status !== 'ready'}
                      onPress={() => toggleSeason(season.seasonNumber, !watched)}
                    />
                    : <Text style={styles.untracked}>Upcoming</Text>}
            </View>

            {hasEpisodeDetails && canToggleEpisodes && <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: episodesExpanded }}
              onPress={() => setEpisodesExpanded((value) => !value)}
              style={({ pressed }) => [styles.episodeToggle, pressed && styles.dimmed]}
            >
              <Text style={styles.episodeToggleText}>
                {episodesExpanded ? 'Hide episodes' : `Show ${episodeCount} episodes`}
              </Text>
            </Pressable>}

            {hasEpisodeDetails && (!canToggleEpisodes || episodesExpanded) && <View style={styles.episodeList}>
              {details.latestSeason!.episodes.map((episode) => {
                const episodeTrackable = latestEpisodeMetadata?.trackableEpisodeNumbers
                  .includes(episode.episodeNumber) ?? false;
                const episodeWatched = latestEpisodeProgress?.watchedEpisodeNumbers
                  .includes(episode.episodeNumber) ?? false;
                const episodeSaving = savingKey
                  === `episode-${episode.seasonNumber}-${episode.episodeNumber}`;
                const formattedDate = formatUkDate(episode.airDate);
                const dateLabel = !formattedDate
                  ? 'Air date unavailable'
                  : episodeTrackable
                    ? episode.airDate === todayIso
                      ? `${formattedDate} · Airs today`
                      : `Aired ${formattedDate}`
                    : `${formattedDate} · ${getCountdownLabel(episode.airDate, todayIso)}`;
                return (
                  <View key={episode.id} style={styles.episodeRow}>
                    <View style={styles.episodeText}>
                      <Text style={styles.episodeTitle}>
                        E{episode.episodeNumber}{episode.name ? ` · ${episode.name}` : ''}
                      </Text>
                      <Text style={styles.secondary}>{dateLabel}</Text>
                    </View>
                    {episodeTrackable
                      ? <ProgressButton
                        label={episodeWatched ? 'Watched' : 'Mark watched'}
                        selected={episodeWatched}
                        saving={episodeSaving}
                        disabled={savingKey !== null || tracking.status !== 'ready'}
                        onPress={() => toggleEpisode(
                          episode.seasonNumber,
                          episode.episodeNumber,
                          !episodeWatched,
                        )}
                      />
                      : <Text style={styles.untracked}>Not available yet</Text>}
                  </View>
                );
              })}
            </View>}
            {isLatest && details.latestSeason?.episodes.length === 0
              && <Text style={styles.secondary}>No episodes have been announced yet.</Text>}
          </View>
        );
      }) : <Text style={styles.body}>Season information is unavailable.</Text>}
    </View>
  );
}

function ProgressButton({
  label,
  selected,
  saving,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  saving: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const styles = createStyles(useTheme());
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled, busy: saving }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.progressButton,
        selected && styles.progressButtonSelected,
        (pressed || disabled) && styles.dimmed,
      ]}
    >
      <Text style={[styles.progressButtonText, selected && styles.progressButtonTextSelected]}>
        {saving ? 'Saving…' : label}
      </Text>
    </Pressable>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
  heading: { color: colors.text, fontSize: 21, fontWeight: '700', marginTop: 24, marginBottom: 12 },
  body: { color: colors.text, fontSize: 16, lineHeight: 25 },
  secondary: { color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
  nextEpisode: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 6, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
  progressText: { color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 8 },
  season: { gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  latestSeason: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 14, marginBottom: 8 },
  seasonHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  seasonText: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  seasonTitle: { color: colors.text, fontSize: 17, fontWeight: '600' },
  latestBadge: { color: colors.onAccent, backgroundColor: colors.accent, borderRadius: 10, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3, fontSize: 11, fontWeight: '800' },
  episodeProgress: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  episodeToggle: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingRight: 12 },
  episodeToggleText: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  episodeList: { marginTop: 4, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.border },
  episodeRow: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  episodeText: { flex: 1, gap: 3 },
  episodeTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  progressButton: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: colors.accent, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  progressButtonSelected: { backgroundColor: colors.accent },
  progressButtonText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  progressButtonTextSelected: { color: colors.onAccent },
  untracked: { color: colors.textSecondary, fontSize: 13, maxWidth: 100, textAlign: 'right' },
  dimmed: { opacity: 0.65 },
  error: { color: colors.danger, fontSize: 14, marginTop: 10 },
});
}
