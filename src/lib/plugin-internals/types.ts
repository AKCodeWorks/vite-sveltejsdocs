export type AutoDocTag = {
  name: string;
  value: string;
};

export type AuthorLinks = Record<string, string>;

export type AuthorProfile = {
  name: string;
  title?: string;
  username?: string;
  bio?: string;
  imageUrl?: string;
  email?: string;
  address?: string;
  phone?: Partial<Record<'mobile' | 'office' | 'home' | 'other', string>>;
  links?: AuthorLinks;
};

export type JsAutoDocsIndexOptions = {
  tagline?: string;
  heading?: string;
  description?: string;
};

export type JsAutoDocsNavbarOptions = {
  collapsed?: boolean;
};

export type AutoDocEntry = {
  id: string;
  slug: string;
  group: string;
  title: string;
  summary: string;
  description: string;
  jsdocRaw: string;
  signature: string;
  filePath: string;
  line: number;
  displayPath: string;
  params: AutoDocTag[];
  returns: string;
  response: string;
  headers: string;
  body: string;
  fetchUrl: string;
  examples: string[];
  tags: AutoDocTag[];
};

export type AutoDocSnapshot = Pick<
  AutoDocEntry,
  | 'group'
  | 'title'
  | 'summary'
  | 'description'
  | 'jsdocRaw'
  | 'signature'
  | 'displayPath'
  | 'params'
  | 'returns'
  | 'response'
  | 'headers'
  | 'body'
  | 'fetchUrl'
  | 'examples'
  | 'tags'
>;

export type DocHistoryVersionRecord = {
  version: string;
  changedAt: string;
  contentHash: string;
  snapshot: AutoDocSnapshot;
};

export type JsAutoDocsOptions = {
  root?: string;
  scanDir?: string;
  outFile?: string;
  includeExtensions?: string[];
  docsTitle?: string;
  collapseJson?: boolean;
  navbar?: JsAutoDocsNavbarOptions;
  index?: JsAutoDocsIndexOptions;
  logo?: string;
  maxVersions?: number;
  enableInProductionBuild?: boolean;
  authors?: Record<string, AuthorProfile>;
};
