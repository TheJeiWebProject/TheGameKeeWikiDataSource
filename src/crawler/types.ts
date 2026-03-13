export interface GameKeeEntry {
  id: number;
  name: string;
  content_id: number;
  child?: GameKeeEntry[];
}

export interface GameKeeInitialState {
  entryList: GameKeeEntry[];
}

export interface ContentDetailResponse {
  code: number;
  msg: string;
  data: {
    id: number;
    title: string;
    content_json: string; // Serialized JSON string
    [key: string]: any;
  };
}

// Types for parsed content_json
export type GameKeeComponentType = 
  | 'illustrated-book' 
  | 'skill-info' 
  | 'relation-info'
  | 'tab-info'
  | 'character-profile'
  | 'paragraph';

export interface GameKeeComponent {
  type: GameKeeComponentType;
  data: any;
  key?: string;
}

export type GameKeeContent = ContentDetailResponse['data'];

export interface OperatorGridData {
  baseData: Array<Array<{ key: string; value: string; type: string }>>;
}
