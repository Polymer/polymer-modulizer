declare module 'recast' {
    
  import * as estree from 'estree';

  export interface File {
    name: string;
    program: estree.Program;
  }

  export function parse(source: string): File;

  export function print(node: estree.Node, options?: any): any;
}