export class IgnoredSite {
  public id: string;
  public hostname: string;

  public getUrl(): string {
    return `${this.hostname}`;
  }

  constructor(id: string, hostname: string) {
    this.id = id;
    this.hostname = hostname;
  }
}
