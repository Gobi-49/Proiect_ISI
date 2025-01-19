import { BrowserModule } from "@angular/platform-browser";
import { NgModule } from "@angular/core";

import { AppComponent } from "./app.component";
import { EsriMapComponent } from "./pages/esri-map/esri-map.component";
import { AppRoutingModule } from "./app-routing.module";

import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';

import { FlexLayoutModule } from '@angular/flex-layout';
import {AngularFireModule} from "@angular/fire/compat"
import { AngularFireDatabaseModule } from '@angular/fire/compat/database';
import { environment } from "src/environments/environment";
import { FirebaseService } from "./services/firebase";
import { SuperheroFactoryService } from "./services/superhero-factory";

import { HomeFBComponent } from "./pages/home_fb/home_fb.component";
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { BrowserAnimationsModule } from "@angular/platform-browser/animations"

@NgModule({
  declarations: [AppComponent, EsriMapComponent, HomeFBComponent, HomeComponent, LoginComponent, RegisterComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    MatTabsModule,
    MatButtonModule,
    AngularFireModule.initializeApp(environment.firebase, 'AngularDemoFirebase'),
    AngularFireDatabaseModule,
    MatDividerModule,
    MatListModule,
    FlexLayoutModule,
    FormsModule,
    HttpClientModule],
  providers: [
    FirebaseService,
    SuperheroFactoryService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
