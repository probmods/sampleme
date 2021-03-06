declare class MongoClient {
  connect(url: string, callback: (err: mixed, db: MongoDB) => mixed): mixed;
}

declare class MongoDB {
  collection(collectionName: string): MongoCollection;
}

declare class MongoCollection {
  s: {
    name: string,
    dbName: string
  };
  findOne<T>(query: Object, projection: Object, callback: ?(err: mixed, data: ?Object) => T): T;
  find(query: Object, projection: Object): MongoResult;
  update<T>(query: Object, update: Object, options: Object, callback: ?(err: mixed, result: ?Object) => T): MongoResult;
  insert<T>(data: Object, callback: ?(err: mixed, result: Object) => T): T;
  insertMany<T>(data: Array<Object>, callback: ?(err: mixed, result: Object) => T): T;
  count<T>(callback: ?(err: mixed, count: number) => T): T;
}

declare class MongoResult {
  toArray<T>(callback: (err: mixed, data: Array<Object>) => T): T;
}
