const EXTINF = "#EXTINF:";

// parse non-variant playlist
// returns null if parsing fails
// otherwise returns a function that returns a reader that gets the following for each line of the playlist:
// { raw: 'line contents', metadata }

// where metadata will be undefined or
// { type: 'url', time, end }
// { type: 'endlist' }

export type Metadata =
  | { type: "url"; time: number; end: boolean; startIndex: number }
  | { type: "endlist" };
export type VariantMetadata = { type: "url" } | { type: "endlist" };

export type Line = { raw: string; metadata?: Metadata };
export type VariantLine = { raw: string; metadata?: VariantMetadata };

export type ParsedPlaylist = () => {
  read: () => Line | null;
};
export type ParsedVariantPlaylist = () => {
  read: () => VariantLine | null;
};

export function parsePlaylist(
  playlist: string,
  infinite: boolean
): ParsedPlaylist | null {
  const playlistLines = playlist
    .trim()
    .split(/\r?\n/g)
    .map((line) => line.trim());
  if (playlistLines[0] !== "#EXTM3U") {
    return null;
  }
  if (playlistLines.some((line) => line.indexOf("#EXT-X-STREAM-INF:") === 0)) {
    // variant playlist
    return null;
  }

  return () => {
    let startIndex = 0;
    let time = 0;
    let segmentDuration = 0;
    let i = -1;
    let increasingI = -1;
    let urlsStart = 0;

    const read = (): Line | null => {
      if (playlistLines.length === 0) {
        return null;
      }

      i++;
      increasingI++;

      if (i >= playlistLines.length) {
        if (!infinite) {
          return null;
        }
        i = urlsStart - 1;
        return { raw: "#EXT-X-DISCONTINUITY" };
      }

      const line = playlistLines[i];
      const data: Line = { raw: line };
      if (line.indexOf(EXTINF) === 0) {
        const newDuration = parseFloat(
          line.substring(EXTINF.length, line.length - 1)
        );
        if (!isNaN(newDuration)) {
          segmentDuration = newDuration;
        }
        startIndex = increasingI;
        if (!urlsStart) {
          urlsStart = i;
        }
      } else if (line && line[0] !== "#") {
        data.metadata = {
          type: "url",
          time,
          startIndex,
          end: !infinite && playlistLines[i + 1] === "#EXT-X-ENDLIST",
        };
        time += segmentDuration;
        segmentDuration = 0;
      } else if (line === "#EXT-X-ENDLIST") {
        if (infinite) {
          increasingI--;
          return read();
        }
        data.metadata = { type: "endlist" };
      }
      return data;
    };

    return {
      read,
    };
  };
}

export function parseVariantPlaylist(
  playlist: string
): ParsedVariantPlaylist | null {
  const playlistLines = playlist
    .trim()
    .split(/\r?\n/g)
    .map((line) => line.trim());
  if (playlistLines[0] !== "#EXTM3U") {
    return null;
  }
  if (!playlistLines.some((line) => line.indexOf("#EXT-X-STREAM-INF:") === 0)) {
    // not variant playlist
    return null;
  }

  return () => {
    let i = -1;
    return {
      read() {
        i++;
        if (i >= playlistLines.length) {
          return null;
        }
        let line = playlistLines[i];

        const data: VariantLine = { raw: line };
        if (line && line[0] !== "#") {
          data.metadata = { type: "url" };
        }
        return data;
      },
    };
  };
}
