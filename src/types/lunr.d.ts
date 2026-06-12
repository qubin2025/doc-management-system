declare module 'lunr' {
  class Index {
    search(query: string): { ref: string; score: number; matchData: any }[];
  }
  function lunr(fn: (this: any) => void): Index;
  export = lunr;
}
