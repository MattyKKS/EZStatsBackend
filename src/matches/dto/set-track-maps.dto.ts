import { IsArray } from 'class-validator';

export interface TrackMapEntry {
  trackId: number;
  playerId: string;
}

// Body for POST /matches/:id/track-maps — the full set of track→player
// assignments for a match (replaces any existing set).
export class SetTrackMapsDto {
  @IsArray()
  maps: TrackMapEntry[];
}
