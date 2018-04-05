import {Document, Import} from 'polymer-analyzer';

export interface ImportWithDocument extends Import {
  readonly document: Document;
}
