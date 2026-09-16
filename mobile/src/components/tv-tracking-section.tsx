import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  formatUkDate,
  getCountdownLabel,
  getDeviceLocalIsoDate,
} from '@/services/air-date-rules';
import { fetchSeasonEpisodes, type EpisodeSummary, type MediaDetails } from '@/services/details';
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

type TrackingState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'ready'; records: TvProgress[] };

export function TvTrackingSection({ details }: { details: MediaDetails }) {
  const [tracking, setTracking] = useState<TrackingState>({ status: 'loading' });
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [expandedSeason, setExpandedSeason] = useState<number | null>(
    details.latestSeason?.seasonNumber ?? null,
  );
  const [loadedSeasons, setLoadedSeasons] = useState<Record<number, EpisodeSummary[]>>(
    details.latestSeason ? { [details.latestSeason.seasonNumber]: details.latestSeason.episodes } : {},
  );
  const [loadingSeason, setLoadingSeason] = useState<number | null>(null);
  const [seasonLoadError, setSeasonLoadError] = useState<number | null>(null);
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
  const loadedEpisodeMetadata = expandedSeason && loadedSeasons[expandedSeason]
    ? deriveEpisodeMetadata(expandedSeason, loadedSeasons[expandedSeason], todayIso)
    : null;

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

  async function toggleSeasonExpanded(seasonNumber: number) {
    if (expandedSeason === seasonNumber) {
      setExpandedSeason(null);
      return;
    }
    setExpandedSeason(seasonNumber);
    setSeasonLoadError(null);
    if (loadedSeasons[seasonNumber]) return;
    setLoadingSeason(seasonNumber);
    try {
      const controller = new AbortController();
      const season = await fetchSeasonEpisodes(details.id, seasonNumber, controller.signal);
      setLoadedSeasons((current) => ({ ...current, [seasonNumber]: season.episodes }));
      const records = await synchronizeTvTracking(details.id, trackableSeasons, deriveEpisodeMetadata(
        seasonNumber,
        season.episodes,
        todayIso,
      ));
      setTracking({ status: 'ready', records });
    } catch {
      setSeasonLoadError(seasonNumber);
    } finally {
      setLoadingSeason(null);
    }
  }

  const progress = tracking.status === 'ready'
    ? findTvProgress(tracking.records, details.id)
    : null;
  const total = progress ? calculateTvProgress(progress) : null;
  const latestEpisodes = details.latestSeason?.episodes ?? [];
  const calendarIndex = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    return Date.UTC(year, month - 1, day) / (24 * 60 * 60 * 1000);
  };
  const todayIndex = calendarIndex(todayIso);
  const recentlyAiredEpisodes = latestEpisodes.filter((episode) => {
    if (!episode.airDate || episode.airDate > todayIso) return false;
    return calendarIndex(episode.airDate) >= todayIndex - 13;
  });

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
      <Text accessibilityRole="header" style={styles.heading}>Recently aired</Text>
      {tracking.status === 'loading' && <Text style={styles.secondary}>Loading progress…</Text>}
      {tracking.status === 'unavailable' && <Text accessibilityRole="alert" style={styles.error}>
        TV tracking is temporarily unavailable.
      </Text>}
      {total && <Text style={styles.progressText}>{total.watched} of {total.total} seasons watched</Text>}
      {trackingError && <Text accessibilityRole="alert" style={styles.error}>{trackingError}</Text>}
      {recentlyAiredEpisodes.length === 0
        ? <Text style={styles.secondary}>No episodes aired in the last 14 days.</Text>
        : <View style={styles.recentEpisodes}>
          {recentlyAiredEpisodes.map((episode) => {
            return <View key={`recent-${episode.id}`} style={styles.episodeRow}>
              <View style={styles.episodeText}>
                <Text style={styles.episodeTitle}>S{episode.seasonNumber}:E{episode.episodeNumber}{episode.name ? ` · ${episode.name}` : ''}</Text>
                <Text style={styles.secondary}>Aired {formatUkDate(episode.airDate)}</Text>
              </View>
            </View>;
          })}
        </View>}

      <Text accessibilityRole="header" style={styles.subheading}>Season progress</Text>
      {seasonsNewestFirst.length ? seasonsNewestFirst.map((season) => {
        const isLatest = details.latestSeason?.seasonNumber === season.seasonNumber;
        const seasonEpisodes = isLatest
          ? details.latestSeason?.episodes ?? []
          : loadedSeasons[season.seasonNumber] ?? [];
        const hasEpisodeDetails = seasonEpisodes.length > 0;
        const isExpanded = expandedSeason === season.seasonNumber;
        const trackable = trackableSeasons.includes(season.seasonNumber);
        const watched = progress?.watchedSeasonNumbers.includes(season.seasonNumber) ?? false;
        const seasonSaving = savingKey === `season-${season.seasonNumber}`;
        const seasonEpisodeProgress = progress
          ? findEpisodeProgress(progress, season.seasonNumber)
          : null;
        const episodeTotal = hasEpisodeDetails && seasonEpisodeProgress
          ? calculateEpisodeProgress(seasonEpisodeProgress)
          : null;
        const allAiredWatched = episodeTotal !== null
          && episodeTotal.total > 0
          && episodeTotal.watched === episodeTotal.total;

        return (
          <View key={season.id} style={styles.season}>
            <View style={styles.seasonHeader}>
              <View style={styles.seasonText}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${isExpanded ? 'Collapse' : 'Expand'} ${season.name}`}
                  onPress={() => void toggleSeasonExpanded(season.seasonNumber)}
                  disabled={loadingSeason !== null}
                >
                  <View style={styles.titleRow}>
                    <Text style={styles.seasonTitle}>{season.name}</Text>
                    <Text style={styles.expandHint}>{isExpanded ? '▾' : '▸'}</Text>
                    {isLatest && <Text style={styles.latestBadge}>Latest season</Text>}
                  </View>
                </Pressable>
                {episodeTotal && episodeTotal.total > 0 && <Text style={styles.episodeProgress}>
                  {episodeTotal.watched}/{episodeTotal.total} watched
                </Text>}
              </View>
              {season.seasonNumber === 0
                ? <Text style={styles.untracked}>Not tracked</Text>
                : hasEpisodeDetails
                  ? episodeTotal && episodeTotal.total > 0
                    ? <ProgressButton
                      label={allAiredWatched ? 'Mark as unwatched' : 'Mark as watched'}
                      selected={allAiredWatched}
                      saving={savingKey === `season-episodes-${season.seasonNumber}`}
                      disabled={savingKey !== null || tracking.status !== 'ready'}
                      onPress={() => toggleAiredEpisodes(season.seasonNumber, !allAiredWatched)}
                    />
                    : null
                  : trackable
                    ? <ProgressButton
                      label={watched ? 'Mark as unwatched' : 'Mark as watched'}
                      selected={watched}
                      saving={seasonSaving}
                      disabled={savingKey !== null || tracking.status !== 'ready'}
                      onPress={() => toggleSeason(season.seasonNumber, !watched)}
                    />
                    : <Text style={styles.untracked}>Upcoming</Text>}
            </View>

            {loadingSeason === season.seasonNumber && <Text style={styles.secondary}>Loading episodes…</Text>}
            {seasonLoadError === season.seasonNumber && <Text accessibilityRole="alert" style={styles.error}>
              Episodes could not be loaded. Try expanding this season again.
            </Text>}
            {isExpanded && hasEpisodeDetails && <View style={styles.episodeList}>
              {seasonEpisodes.map((episode) => {
                const metadata = isLatest ? latestEpisodeMetadata : loadedEpisodeMetadata;
                const episodeProgress = progress
                  ? findEpisodeProgress(progress, season.seasonNumber)
                  : null;
                const episodeTrackable = metadata?.trackableEpisodeNumbers
                  .includes(episode.episodeNumber) ?? false;
                const episodeWatched = episodeProgress?.watchedEpisodeNumbers
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
                    : formattedDate;
                const availabilityLabel = !episodeTrackable
                  ? getCountdownLabel(episode.airDate, todayIso)
                  : null;
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
                        label={episodeWatched ? 'Mark as unwatched' : 'Mark as watched'}
                        selected={episodeWatched}
                        saving={episodeSaving}
                        disabled={savingKey !== null || tracking.status !== 'ready'}
                        onPress={() => toggleEpisode(
                          episode.seasonNumber,
                          episode.episodeNumber,
                          !episodeWatched,
                        )}
                      />
                      : <Text style={styles.untracked}>{availabilityLabel}</Text>}
                  </View>
                );
              })}
            </View>}
            {isExpanded && isLatest && details.latestSeason?.episodes.length === 0
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

const styles = StyleSheet.create({
  heading: { color: '#FFFFFF', fontSize: 21, fontWeight: '700', marginTop: 24, marginBottom: 12 },
  subheading: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginTop: 14, marginBottom: 4 },
  body: { color: '#FFFFFF', fontSize: 16, lineHeight: 25 },
  secondary: { color: '#A7A7B0', fontSize: 14, lineHeight: 22 },
  progressText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginBottom: 8 },
  season: { gap: 12, padding: 14, marginTop: 8, backgroundColor: '#16161B', borderRadius: 12 },
  seasonHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  seasonText: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  seasonTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  expandHint: { color: '#D5D5DC', fontSize: 20, fontWeight: '700' },
  latestBadge: { color: '#0B0B0F', backgroundColor: '#FFFFFF', borderRadius: 10, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3, fontSize: 11, fontWeight: '800' },
  episodeProgress: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  recentEpisodes: { gap: 8, marginBottom: 8 },
  episodeList: { marginTop: 4, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: '#393940' },
  episodeRow: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#292930' },
  episodeText: { flex: 1, gap: 3 },
  episodeTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  progressButton: { borderWidth: 1, borderColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  progressButtonSelected: { backgroundColor: '#FFFFFF' },
  progressButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  progressButtonTextSelected: { color: '#0B0B0F' },
  untracked: { color: '#A7A7B0', fontSize: 13, maxWidth: 110, textAlign: 'right' },
  dimmed: { opacity: 0.65 },
  error: { color: '#FF8A8A', fontSize: 14, marginTop: 10 },
});
