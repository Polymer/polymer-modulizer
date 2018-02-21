// https://docs.npmjs.com/files/package.json
interface NpmConfig {
  name: string;
  version: string;
  description?: string;
  keywords?: string[];
  homepage?: string;
  bugs?: {url?: string, email?: string}|string;
  license?: string;
  author?: NpmPerson|string;
  contributors?: Array<NpmPerson|string>;
  files?: string[];
  main?: string;
  bin?: {[cmd: string]: string};
  man?: string|string[];
  repository?: {type: string, url: string}|string;
  scripts?: {[cmd: string]: string};
  dependencies?: {[pkg: string]: string}|string;
  devDependencies?: {[pkg: string]: string}|string;
  peerDependencies?: {[pkg: string]: string}|string;
  private?: boolean;
}

interface YarnConfig extends NpmConfig {
  flat?: boolean;
  resolutions?: {[pkg: string]: string};
}

interface NpmPerson {
  name?: string;
  email?: string;
  url?: string;
}
