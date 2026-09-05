export interface Prop {
  id: string;
  name: string;
  description: string;
  type?: string;
  visualDescription?: string;
  locationId: string;
  appearsInScenes: string[];
}

export interface Location {
  id: string;
  seriesId: string;
  name: string;
  description: string;
  type?: string;
  visualDescription?: string;
  roomDetails?: string;
  lighting?: string;
  visualStyle?: string;
  props: Prop[];
  continuityNotes?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface LocationInput {
  name: string;
  description: string;
  type?: string;
  visualDescription?: string;
  roomDetails?: string;
  lighting?: string;
  visualStyle?: string;
  continuityNotes?: string[];
}
