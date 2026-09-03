export interface Prop {
  id: string;
  name: string;
  description: string;
  locationId: string;
  appearsInScenes: string[];
}

export interface Location {
  id: string;
  seriesId: string;
  name: string;
  description: string;
  roomDetails?: string;
  lighting?: string;
  visualStyle?: string;
  props: Prop[];
  createdAt: Date;
  updatedAt: Date;
}
