declare module "firebase/firestore" {
  export interface Firestore {
    type: string;
    app: any;
    toJSON: () => object;
  }

  export interface DocumentData {
    [field: string]: any;
  }

  export interface SnapshotListenOptions {
    includeMetadataChanges?: boolean;
  }

  export interface SnapshotMetadata {
    hasPendingWrites: boolean;
    fromCache: boolean;
    isEqual: (other: SnapshotMetadata) => boolean;
  }

  export interface DocumentReference<T = DocumentData> {
    id: string;
    path: string;
    parent: CollectionReference<T>;
    firestore: Firestore;
  }

  export interface CollectionReference<T = DocumentData> {
    id: string;
    path: string;
    parent: DocumentReference<DocumentData> | null;
    firestore: Firestore;
  }

  export interface Query<T = DocumentData> {
    firestore: Firestore;
  }

  export interface QueryDocumentSnapshot<T = DocumentData> {
    id: string;
    ref: DocumentReference<T>;
    exists: () => boolean;
    data: () => T;
    get: (fieldPath: string) => any;
    metadata: SnapshotMetadata;
  }

  export interface QuerySnapshot<T = DocumentData> {
    docs: QueryDocumentSnapshot<T>[];
    empty: boolean;
    size: number;
    metadata: SnapshotMetadata;
    forEach: (callback: (result: QueryDocumentSnapshot<T>) => void, thisArg?: any) => void;
    docChanges: () => any[];
  }

  export interface DocumentSnapshot<T = DocumentData> {
    id: string;
    ref: DocumentReference<T>;
    exists: () => boolean;
    data: () => T | undefined;
    get: (fieldPath: string) => any;
    metadata: SnapshotMetadata;
  }

  export interface WriteBatch {
    set: <T = DocumentData>(documentRef: DocumentReference<T>, data: Partial<T>, options?: any) => WriteBatch;
    update: <T = DocumentData>(documentRef: DocumentReference<T>, data: any) => WriteBatch;
    delete: (documentRef: DocumentReference<any>) => WriteBatch;
    commit: () => Promise<void>;
  }

  export type Unsubscribe = () => void;

  export function getFirestore(app?: any): Firestore;
  export function initializeFirestore(app: any, settings: any): Firestore;
  export function persistentLocalCache(settings?: any): any;
  export function collection(firestore: Firestore, path: string, ...pathSegments: string[]): CollectionReference<DocumentData>;
  export function doc(firestore: Firestore, path: string, ...pathSegments: string[]): DocumentReference<DocumentData>;
  export function doc<T = DocumentData>(reference: CollectionReference<T>, path?: string, ...pathSegments: string[]): DocumentReference<T>;
  export function getDoc<T = DocumentData>(reference: DocumentReference<T>): Promise<DocumentSnapshot<T>>;
  export function getDocs<T = DocumentData>(query: Query<T> | CollectionReference<T>): Promise<QuerySnapshot<T>>;
  export function getDocsFromCache<T = DocumentData>(query: Query<T> | CollectionReference<T>): Promise<QuerySnapshot<T>>;
  export function setDoc<T = DocumentData>(reference: DocumentReference<T>, data: Partial<T>, options?: any): Promise<void>;
  export function updateDoc<T = DocumentData>(reference: DocumentReference<T>, data: any): Promise<void>;
  export function deleteDoc(reference: DocumentReference<any>): Promise<void>;
  export function addDoc<T = DocumentData>(reference: CollectionReference<T>, data: T): Promise<DocumentReference<T>>;
  
  export function onSnapshot<T = DocumentData>(
    reference: DocumentReference<T>,
    onNext: (snapshot: DocumentSnapshot<T>) => void,
    onError?: (error: any) => void
  ): Unsubscribe;
  export function onSnapshot<T = DocumentData>(
    reference: DocumentReference<T>,
    options: SnapshotListenOptions,
    onNext: (snapshot: DocumentSnapshot<T>) => void,
    onError?: (error: any) => void
  ): Unsubscribe;
  export function onSnapshot<T = DocumentData>(
    query: Query<T> | CollectionReference<T>,
    onNext: (snapshot: QuerySnapshot<T>) => void,
    onError?: (error: any) => void
  ): Unsubscribe;
  export function onSnapshot<T = DocumentData>(
    query: Query<T> | CollectionReference<T>,
    options: SnapshotListenOptions,
    onNext: (snapshot: QuerySnapshot<T>) => void,
    onError?: (error: any) => void
  ): Unsubscribe;

  export function query<T = DocumentData>(query: Query<T> | CollectionReference<T>, ...queryConstraints: any[]): Query<T>;
  export function where(fieldPath: string, opStr: string, value: any): any;
  export function orderBy(fieldPath: string, directionStr?: "asc" | "desc"): any;
  export function limit(limit: number): any;
  export function arrayUnion(...elements: any[]): any;
  export function writeBatch(firestore: Firestore): WriteBatch;
  export function memoryLocalCache(settings?: any): any;
  export function persistentLocalCache(settings?: any): any;
}
