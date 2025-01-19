import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  Output,
  EventEmitter,
  OnDestroy,
} from "@angular/core";

import esri = __esri;

import Config from "@arcgis/core/config";
import WebMap from "@arcgis/core/WebMap";
import MapView from "@arcgis/core/views/MapView";
import Graphic from "@arcgis/core/Graphic";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Polygon from "@arcgis/core/geometry/Polygon";
import Point from "@arcgis/core/geometry/Point";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import TextSymbol from "@arcgis/core/symbols/TextSymbol";
import Locator from "@arcgis/core/widgets/Locate";
import * as geometryEngine from "@arcgis/core/geometry/geometryEngine";

@Component({
  selector: "app-esri-map",
  templateUrl: "./esri-map.component.html",
  styleUrls: ["./esri-map.component.scss"],
})
export class EsriMapComponent implements OnInit, OnDestroy {
  @Output() mapLoadedEvent = new EventEmitter<boolean>();
  @ViewChild("mapViewNode", { static: true }) private mapViewEl: ElementRef;

  map: esri.Map;
  view: esri.MapView;
  graphicsLayerUserPoints: esri.GraphicsLayer;
  userPoints: esri.Point[] = [];
  firstPointGraphic: esri.Graphic | null = null;

  drawingEnabled = false;

  zoom = 6;
  center: Array<number> = [24.9668, 45.9432];
  basemap = "streets-vector";

  constructor() {}

  ngOnInit() {
    this.initializeMap().then(() => {
      this.mapLoadedEvent.emit(true);
    });
  }

  async initializeMap() {
    try {
      Config.apiKey = "AAPTxy8BH1VEsoebNVZXo8HurPxd2y4Ptl2y4MUtfoSUm4gvFLIvRdC-JNxvjr_04-85XlgtIiJfjCJMBY2TFQYsV71ZHhvF8A1jXCH2mfA75PKyUY4F-d3pcoZ2xRySOuj2_TE4xWFLZ-rzsM3MHtXk23yPC6mVJ8Lg0VBt_h2Bl9f-6qwJrSzJukiI9W2OyzNv1oC0PzjCJjqpQfHIzDKN4Vr8kZrAr5hesiapukxQ8xs.AT1_yPgqjVU9";

      this.map = new WebMap({ basemap: this.basemap });

      this.graphicsLayerUserPoints = new GraphicsLayer({
        listMode: "show",
      });
      this.map.add(this.graphicsLayerUserPoints);

      this.view = new MapView({
        container: this.mapViewEl.nativeElement,
        center: this.center,
        zoom: this.zoom,
        map: this.map,
      });

      const locateWidget = new Locator({
        view: this.view,
        useHeadingEnabled: false,
        goToOverride: (view, options) => {
          options.target.zoom = 15;
          return view.goTo(options.target);
        },
      });

      this.view.ui.add(locateWidget, {
        position: "top-left",
      });

      this.view.on("click", async (event) => {
        if (this.drawingEnabled) {
          this.handleClick(event);
        } else {
          this.handleCenterPointClick(event);
        }
      });
    } catch (error) {
      console.error("Error initializing map:", error);
    }

    this.view.popup.defaultPopupTemplateEnabled = true;
    this.view.popup.autoCloseEnabled = false;
  }

  enableDrawing() {
    this.drawingEnabled = true;
    console.log("Drawing enabled");
  }

  disableDrawing() {
    this.drawingEnabled = false;
    console.log("Drawing disabled");
  }

  async handleClick(event: esri.ViewClickEvent) {
    const hitTestResult = await this.view.hitTest(event);

    const hitGraphic = hitTestResult.results
      .find(
        (result): result is esri.ViewHit & { graphic: esri.Graphic } =>
          "graphic" in result && result.graphic?.attributes?.type === "temporary"
      )
      ?.graphic;

    if (hitGraphic && this.firstPointGraphic && hitGraphic === this.firstPointGraphic) {
      if (this.userPoints.length < 3) {
        console.log("Not enough points for a polygon. Canceling draw.");
        this.cancelPolygon();
      } else {
        this.createPolygon();
        this.disableDrawing();
      }
    } else {
      this.addPoint(event.mapPoint);
    }
  }

  handleCenterPointClick(event: esri.ViewClickEvent) {
    const mapPoint = event.mapPoint;
    this.view.hitTest(event).then((result) => {
      const matchedGraphic = result.results
        .filter((r): r is __esri.ViewHit & { graphic: __esri.Graphic } => "graphic" in r)
        .find((r) => r.graphic.attributes?.type === "userPolygon")?.graphic;
  
      if (matchedGraphic) {
        this.selectedPolygonGraphic = matchedGraphic; // Set the selected polygon
  
        const polygon = matchedGraphic.geometry as Polygon;
        const area = geometryEngine.geodesicArea(polygon, "square-meters");
        const customInfo = matchedGraphic.attributes.customInfo || "No custom info provided.";
  
        // Format content for the info panel
        const infoContent = `
          <strong>Area:</strong> ${area.toFixed(2)} square meters<br>
          <strong>Custom Info:</strong> ${customInfo}
        `;
  
        // Display the info panel
        const infoPanel = document.getElementById("polygon-info-panel");
        const infoContentEl = document.getElementById("polygon-info-content");
        if (infoPanel && infoContentEl) {
          infoContentEl.innerHTML = infoContent;
          infoPanel.style.display = "block";
        }
      }
    });
  }  
  
  getCenterPointGraphic(): esri.Graphic | null {
    const graphics = this.graphicsLayerUserPoints.graphics.toArray();
    return graphics.find(
      (graphic) => graphic.attributes?.type === "centerPoint"
    ) || null;
  }

  addPoint(mapPoint: esri.Point) {
    this.userPoints.push(mapPoint);
    const pointGraphic = this.createPointGraphic(mapPoint);

    if (this.userPoints.length === 1) {
      this.firstPointGraphic = pointGraphic;
    }
  }

  createPointGraphic(mapPoint: esri.Point): esri.Graphic {
    const markerSymbol = new SimpleMarkerSymbol({
      color: "blue",
      size: "18px",
      outline: { color: [255, 255, 255], width: 2 },
    });

    const pointGraphic = new Graphic({
      geometry: mapPoint,
      symbol: markerSymbol,
      attributes: { type: "temporary" },
    });

    const textSymbol = new TextSymbol({
      text: `${this.userPoints.length}`,
      color: "black",
      haloColor: "white",
      haloSize: "2px",
      font: { size: 12, family: "sans-serif" },
      yoffset: -15,
    });

    const textGraphic = new Graphic({
      geometry: mapPoint,
      symbol: textSymbol,
      attributes: { type: "temporary" },
    });

    this.graphicsLayerUserPoints.addMany([pointGraphic, textGraphic]);
    return pointGraphic;
  }

  createPolygon() {
    const polygon = new Polygon({
      rings: [this.userPoints.map((p) => [p.longitude, p.latitude])],
      spatialReference: { wkid: 4326 },
    });
  
    const fillSymbol = new SimpleFillSymbol({
      color: [227, 139, 79, 0.8],
      outline: { color: [255, 255, 255], width: 2 },
    });
  
    const polygonGraphic = new Graphic({
      geometry: polygon,
      symbol: fillSymbol,
      attributes: { type: "userPolygon", customInfo: "" }, // Initialize with an empty customInfo
    });
  
    this.graphicsLayerUserPoints.add(polygonGraphic);
  
    const centerPoint = polygon.extent.center;
    this.addCenterPoint(centerPoint, polygon);
  
    this.cleanupTemporaryGraphics();
    console.log("Polygon created:", polygonGraphic);
  }  

  addCenterPoint(centerPoint: esri.Point, polygon: Polygon) {
    const markerSymbol = new SimpleMarkerSymbol({
      color: "red",
      size: "14px",
      outline: { color: [255, 255, 255], width: 1 },
    });

    const centerGraphic = new Graphic({
      geometry: centerPoint,
      symbol: markerSymbol,
      attributes: { type: "centerPoint", polygon },
    });

    this.graphicsLayerUserPoints.add(centerGraphic);
    console.log("Center point added:", centerGraphic);
  }

  cleanupTemporaryGraphics() {
    this.graphicsLayerUserPoints.removeMany(
      this.graphicsLayerUserPoints.graphics.toArray().filter((g) => g.attributes?.type === "temporary")
    );
    this.userPoints = [];
    this.firstPointGraphic = null;
    console.log("Temporary graphics cleared");
  }

  cancelPolygon() {
    this.cleanupTemporaryGraphics();
    console.log("Polygon formation canceled");
  }

  clearRouter() {
    this.graphicsLayerUserPoints?.removeAll();
    this.userPoints = [];
    this.firstPointGraphic = null;
    console.log("Map cleared");
  }

  ngOnDestroy() {
    if (this.view) {
      this.view.container = null;
    }
  }

  hidePolygonInfoPanel() {
    const infoPanel = document.getElementById("polygon-info-panel");
    if (infoPanel) {
      infoPanel.style.display = "none";
    }
  }

  addPolygonInfo() {
    const polygonInfoPanel = document.getElementById("polygon-info-panel");
    
    // Example logic for adding more info
    const additionalInfo = `
      <strong>Additional Info:</strong> This is a user-defined note about the polygon.<br>
      <strong>Date:</strong> ${new Date().toLocaleDateString()}
    `;
  
    // Append new info to the existing content
    const infoContentEl = document.getElementById("polygon-info-content");
    if (infoContentEl) {
      infoContentEl.innerHTML += `<br>${additionalInfo}`;
    }
  
    console.log("Add More Info button clicked!");
  }

  selectedPolygonGraphic: esri.Graphic | null = null; // Keep track of the currently selected polygon

  saveCustomInfo() {
  const customInfoInput = document.getElementById("custom-info-input") as HTMLInputElement;
  const customInfo = customInfoInput?.value;

  if (customInfo && this.selectedPolygonGraphic) {
    // Save the custom info to the polygon's attributes
    this.selectedPolygonGraphic.attributes.customInfo = customInfo;

    const infoContentEl = document.getElementById("polygon-info-content");
    if (infoContentEl) {
      infoContentEl.innerHTML += `<br><strong>Custom Info:</strong> ${customInfo}`;
    }

    // Clear the input field
    customInfoInput.value = "";

    console.log("Custom info saved:", customInfo);
  } else {
    console.log("No custom info provided or no polygon selected.");
  }
}
}
