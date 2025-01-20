import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { Observable } from 'rxjs';
import { AngularFirestore } from '@angular/fire/compat/firestore';

export interface IDatabaseItem {
    name: string;
    val: string;
}

@Injectable()
export class FirebaseService {
  constructor(private firestore: AngularFirestore) {}

  savePolygon(polygonData: any) {
    return this.firestore.collection('polygons').add(polygonData);
  }

  getPolygons() {
    return this.firestore.collection('polygons').snapshotChanges();
  }
}

// export class FirebaseService {

//     listFeed: Observable<any[]>;
//     objFeed: Observable<any>;

//     constructor(public db: AngularFireDatabase) {

//     }

//     connectToDatabase() {
//         this.listFeed = this.db.list('list').valueChanges();
//         this.objFeed = this.db.object('obj').valueChanges();
//     }

//     getChangeFeedList() {
//         return this.listFeed;
//     }

//     getChangeFeedObject() {
//         return this.objFeed;
//     }

//     removeListItems() {
//         this.db.list('list').remove();
//     }

//     addListObject(val: string) {
//         let item: IDatabaseItem = {
//             name: "test",
//             val: val
//         };
//         this.db.list('list').push(item);
//     }

//     updateObject(val: string) {
//         let item: IDatabaseItem = {
//             name: "test",
//             val: val
//         };
//         this.db.object('obj').set([item]);
//     }
// }
