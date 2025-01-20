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

  async savePolygon(polygonData: any) {
    const ref = await this.firestore.collection('polygons').add(polygonData);
    this.firestore.collection('polygons').doc(ref.id).update({id: ref.id,});
    return ref.id;
  }

  getPolygons() {
    return this.firestore.collection('polygons').snapshotChanges();
  }

  deletePolygon(ref_id: string) {
    this.firestore.collection('polygons').doc(ref_id).delete();
  }
}
