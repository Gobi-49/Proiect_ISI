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
import { ActivatedRoute } from '@angular/router';
import { FirebaseService } from "src/app/services/firebase";

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

  filterSoilType: string = "All";
  filterPlantType: string = "All";

  userEmail: string | null = null;

  nrTerrains: Number = 0;

  constructor(private firebaseService: FirebaseService, private route: ActivatedRoute) {}

  ngOnInit() {
    this.initializeMap().then(() => {
        this.mapLoadedEvent.emit(true);

        // Event listeners for filter dropdowns
        const soilTypeDropdown = document.getElementById("filter-soil-type") as HTMLSelectElement;
        const plantTypeDropdown = document.getElementById("filter-plant-type") as HTMLSelectElement;

        if (soilTypeDropdown && plantTypeDropdown) {
            soilTypeDropdown.addEventListener("change", (event) => {
                this.filterSoilType = (event.target as HTMLSelectElement).value;
            });

            plantTypeDropdown.addEventListener("change", (event) => {
                this.filterPlantType = (event.target as HTMLSelectElement).value;
            });
        }
    });

    this.route.queryParams.subscribe((params) => {
      this.userEmail = params['email'];
      console.log('User Email:', this.userEmail);
    });

    this.nrTerrains = this.loadPolygons();
    console.log(this.nrTerrains);
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
    this.view.hitTest(event).then((result) => {
        const matchedGraphic = result.results
            .filter((r): r is __esri.ViewHit & { graphic: esri.Graphic } => "graphic" in r)
            .find((r) => r.graphic.attributes?.type === "userPolygon")?.graphic;

        if (matchedGraphic) {
            this.selectedPolygonGraphic = matchedGraphic;

            const polygon = matchedGraphic.geometry as Polygon;
            const areaInSquareMeters = Math.abs(geometryEngine.geodesicArea(polygon, "square-meters"));
            const areaInHectares = areaInSquareMeters / 10000;

            this.updateInfoPanel(areaInHectares);

            const infoPanel = document.getElementById("polygon-info-panel");
            if (infoPanel) {
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
    // Create a polygon using user points
    const polygon = new Polygon({
        rings: [this.userPoints.map((p) => [p.longitude, p.latitude])],
        spatialReference: { wkid: 4326 },
    });

    // Define the fill symbol for the polygon
    const fillSymbol = new SimpleFillSymbol({
        color: [227, 139, 79, 0.8],
        outline: { color: [255, 255, 255], width: 2 },
    });

    // Get plant type and soil type from dropdowns
    const plantTypeDropdown = document.getElementById("plant-type") as HTMLSelectElement;
    const soilTypeDropdown = document.getElementById("soil-type") as HTMLSelectElement;

    const plantType = plantTypeDropdown ? plantTypeDropdown.value : "Unknown";
    const soilType = soilTypeDropdown ? soilTypeDropdown.value : "Unknown";

    // Create a graphic for the polygon with attributes
    const polygonGraphic = new Graphic({
        geometry: polygon,
        symbol: fillSymbol,
        attributes: { 
            type: "userPolygon", 
            plantType: plantType,
            soilType: soilType,
            customInfo: {}, // Initialize an empty object for custom info
        },
        visible: true, // Default visibility for filtering
    });

    // Add the polygon to the graphics layer
    this.graphicsLayerUserPoints.add(polygonGraphic);

    // Cleanup temporary graphics and reset user points
    this.cleanupTemporaryGraphics();

    console.log("Polygon created with attributes:", { plantType, soilType });
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
    this.disableDrawing();
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

flattenRings(rings: number[][][]): number[] {
  const flattened: number[] = [];
  rings.forEach((ring) => {
    ring.forEach((point) => {
      flattened.push(...point); // Push the longitude and latitude
    });
  });
  return flattened;
}

saveCustomInfo() {
    const customInfoInput = document.getElementById("custom-info-input") as HTMLInputElement;
    const customInfoTitle = document.getElementById("custom-info-title") as HTMLSelectElement;
    const soilTypeDropdown = document.getElementById("soil-type") as HTMLSelectElement;
    const plantTypeDropdown = document.getElementById("plant-type") as HTMLSelectElement;

    const customInfoKey = customInfoTitle?.value;
    const customInfoValue = customInfoInput?.value.trim(); // Trim spaces from input
    const selectedSoilType = soilTypeDropdown?.value || "Unknown";
    const selectedPlantType = plantTypeDropdown?.value || "Unknown";

    if (!this.selectedPolygonGraphic) {
        console.error("Error: No polygon selected.");
        return;
    }

    // Update soil and crop types in the selected polygon attributes
    this.selectedPolygonGraphic.attributes.soilType = selectedSoilType;
    this.selectedPolygonGraphic.attributes.plantType = selectedPlantType;

    console.log(`Soil type saved as: ${selectedSoilType}, Plant type saved as: ${selectedPlantType}`);

    // Save custom info if provided
    if (customInfoKey && customInfoValue) {
        if (!this.selectedPolygonGraphic.attributes.customInfo) {
            this.selectedPolygonGraphic.attributes.customInfo = {};
        }

        if (!Array.isArray(this.selectedPolygonGraphic.attributes.customInfo[customInfoKey])) {
            this.selectedPolygonGraphic.attributes.customInfo[customInfoKey] = [];
        }

        const currentDate = new Date().toLocaleDateString();
        const entry = `${customInfoValue} (Date: ${currentDate})`;
        this.selectedPolygonGraphic.attributes.customInfo[customInfoKey].push(entry);

        console.log("Custom info saved:", { key: customInfoKey, value: entry });
    } else if (!customInfoKey) {
        console.warn("No custom info title selected.");
    } else if (!customInfoValue) {
        console.warn("Empty custom info ignored.");
    }

    // Refresh the info panel to show updated soil and crop types, and any new custom info
    const polygon = this.selectedPolygonGraphic.geometry as Polygon;
    const areaInSquareMeters = Math.abs(geometryEngine.geodesicArea(polygon, "square-meters"));
    const areaInHectares = areaInSquareMeters / 10000;

    this.updateInfoPanel(areaInHectares);

    const flattenedRings = this.flattenRings(polygon.rings);

    const polygonData = {
      geometry: { rings: flattenedRings, spatialReference: polygon.spatialReference.toJSON() },
      soilType: selectedSoilType,
      plantType: selectedPlantType,
      area: areaInHectares,
      customInfo: {
          [customInfoKey]: customInfoValue ? [`${customInfoValue} (Date: ${new Date().toLocaleDateString()})`] : [],
      },
      user: this.userEmail,
  };

  // Save polygon data to Firebase
  this.firebaseService.savePolygon(polygonData)
      .then(() => console.log('Polygon saved successfully!'))
      .catch((error) => console.error('Error saving polygon:', error));

    // Clear the input field after saving
    if (customInfoInput) {
        customInfoInput.value = "";
    }
}

rebuildRings(flattenedRings: number[]): number[][][] {
  const rings: number[][] = [];
  for (let i = 0; i < flattenedRings.length; i += 2) {
    rings.push([flattenedRings[i], flattenedRings[i + 1]]);
  }
  return [rings]; // Wrap it in an array to form the rings structure
}

  loadPolygons() {
    var cont = 0;

    this.firebaseService.getPolygons().subscribe((snapshot) => {
        snapshot.forEach((doc: any) => {
            const data = doc.payload.doc.data();
            const email = data.user;

            if (email === this.userEmail) {
              cont++;
            
              const flattenedRings = data.geometry.rings;
              const rings = this.rebuildRings(flattenedRings);

              // Create the polygon geometry
              const polygon = new Polygon({
                  rings: rings,
                  spatialReference: data.geometry.spatialReference,
              });

              // Create and add the graphic to the map
              const graphic = new Graphic({
                  geometry: polygon,
                  symbol: new SimpleFillSymbol({
                      color: [227, 139, 79, 0.8],
                      outline: { color: [255, 255, 255], width: 2 },
                  }),
                  attributes: {
                      type: 'userPolygon',
                      soilType: data.soilType,
                      plantType: data.plantType,
                      customInfo: data.customInfo,
                  },
              });

              this.graphicsLayerUserPoints.add(graphic);
            }
        });

        console.log('We found ' + cont + ' terrains for user ' + this.userEmail);
    });

    return cont;
}

  updatePlantType(event: Event) {
    const selectedType = (event.target as HTMLSelectElement).value;
    if (this.selectedPolygonGraphic) {
        this.selectedPolygonGraphic.attributes.plantType = selectedType;
        console.log(`Plant type updated to: ${selectedType}`);
    } else {
        console.log("No polygon selected to update plant type.");
    }
  }

  deleteTerrain() {
    if (this.selectedPolygonGraphic) {
        // Remove the selected polygon from the graphics layer
        this.graphicsLayerUserPoints.remove(this.selectedPolygonGraphic);

        // Clear the info panel
        const infoPanel = document.getElementById("polygon-info-panel");
        if (infoPanel) {
            infoPanel.style.display = "none";
        }

        console.log("Terrain deleted:", this.selectedPolygonGraphic);
        this.selectedPolygonGraphic = null; // Clear the selected polygon reference
    } else {
        console.error("No terrain selected for deletion.");
    }
  }

  updateSoilType(event: Event) {
    const selectedSoilType = (event.target as HTMLSelectElement).value;
    if (this.selectedPolygonGraphic) {
        this.selectedPolygonGraphic.attributes.soilType = selectedSoilType;
        console.log(`Soil type updated to: ${selectedSoilType}`);
    } else {
        console.log("No polygon selected to update soil type.");
    }
  }

  updateInfoPanel(areaInHectares: number) {
    if (this.selectedPolygonGraphic) {
        const customInfo = this.selectedPolygonGraphic.attributes.customInfo || {};
        const soilType = this.selectedPolygonGraphic.attributes.soilType || "Unknown";
        const plantType = this.selectedPolygonGraphic.attributes.plantType || "Unknown";

        // Update soil and crop type elements independently
        const cropTypeEl = document.getElementById("polygon-crop-type");
        const soilTypeEl = document.getElementById("polygon-soil-type");

        if (cropTypeEl) {
            cropTypeEl.textContent = plantType; // Update crop type on screen
        }

        if (soilTypeEl) {
            soilTypeEl.textContent = soilType; // Update soil type on screen
        }

        // Generate custom info HTML dynamically
        const customInfoHtml = Object.entries(customInfo)
            .map(([key, values]) =>
                Array.isArray(values)
                    ? `<strong>${key}:</strong><br>${values
                          .map((value, index) => `
                              <div style="display: flex; justify-content: space-between; align-items: center; margin-left: 20px;">
                                  <span>${value}</span>
                                  <button 
                                      style="background: none; border: none; color: red; cursor: pointer;" 
                                      onclick="deleteCustomInfo('${key}', ${index})">✖</button>
                              </div>
                          `)
                          .join("")}`
                    : `<strong>${key}:</strong> ${values}`
            )
            .join("<br>");

        // Update the polygon info panel content
        const infoContentEl = document.getElementById("polygon-info-content");
        if (infoContentEl) {
            infoContentEl.innerHTML = `
                <strong>Area:</strong> ${areaInHectares.toFixed(2)} hectares<br>
                ${customInfoHtml || "<em>No additional info available</em>"} <!-- Show a message if customInfo is empty -->
            `;
        }
    }
}

  deleteCustomInfo(key: string, index: number) {
    if (this.selectedPolygonGraphic && this.selectedPolygonGraphic.attributes.customInfo) {
        const customInfoArray = this.selectedPolygonGraphic.attributes.customInfo[key];
        if (Array.isArray(customInfoArray)) {
            customInfoArray.splice(index, 1); // Remove the specific entry

            // If the array becomes empty, delete the key entirely
            if (customInfoArray.length === 0) {
                delete this.selectedPolygonGraphic.attributes.customInfo[key];
            }

            // Refresh the info panel
            const polygon = this.selectedPolygonGraphic.geometry as Polygon;
            const areaInSquareMeters = Math.abs(geometryEngine.geodesicArea(polygon, "square-meters"));
            const areaInHectares = areaInSquareMeters / 10000;
            this.refreshInfoPanel(areaInHectares);

            console.log(`Custom info "${key}" at index ${index} deleted.`);
        }
    }
  }

  refreshInfoPanel(areaInHectares: number) {
    if (!this.selectedPolygonGraphic) return;

    const customInfo = this.selectedPolygonGraphic.attributes.customInfo || {};
    const soilType = this.selectedPolygonGraphic.attributes.soilType || "Unknown";
    const plantType = this.selectedPolygonGraphic.attributes.plantType || "Unknown";

    // Update crop and soil type elements
    const cropTypeEl = document.getElementById("polygon-crop-type");
    const soilTypeEl = document.getElementById("polygon-soil-type");

    if (cropTypeEl) {
        cropTypeEl.textContent = plantType;
    }
    if (soilTypeEl) {
        soilTypeEl.textContent = soilType;
    }

    // Get the polygon info panel content element
    const infoContentEl = document.getElementById("polygon-info-content");
    if (infoContentEl) {
        // Clear existing content
        infoContentEl.innerHTML = `
            <strong>Area:</strong> ${areaInHectares.toFixed(2)} hectares<br>
            <strong>Custom Info:</strong>
        `;

        // Populate custom info dynamically
        Object.entries(customInfo).forEach(([key, values]) => {
            if (Array.isArray(values)) {
                values.forEach((value, index) => {
                    // Create a container for each entry
                    const entryDiv = document.createElement("div");
                    entryDiv.style.display = "flex";
                    entryDiv.style.justifyContent = "space-between";
                    entryDiv.style.alignItems = "center";
                    entryDiv.style.marginLeft = "20px";

                    // Add the info text
                    const span = document.createElement("span");
                    span.textContent = `${key}: ${value}`;
                    entryDiv.appendChild(span);

                    // Add the delete button
                    const deleteButton = document.createElement("button");
                    deleteButton.textContent = "✖";
                    deleteButton.style.background = "none";
                    deleteButton.style.border = "none";
                    deleteButton.style.color = "red";
                    deleteButton.style.cursor = "pointer";

                    // Attach the click event to delete the entry
                    deleteButton.addEventListener("click", () => {
                        this.deleteCustomInfo(key, index);
                    });

                    entryDiv.appendChild(deleteButton);
                    infoContentEl.appendChild(entryDiv);
                });
            }
        });
    }
}

  applyFilter() {
    if (!this.graphicsLayerUserPoints) return;

    const graphics = this.graphicsLayerUserPoints.graphics.toArray();

    graphics.forEach((graphic) => {
        if (graphic.attributes?.type === "userPolygon") {
            const matchesSoilType =
                this.filterSoilType === "All" || graphic.attributes.soilType === this.filterSoilType;
            const matchesPlantType =
                this.filterPlantType === "All" || graphic.attributes.plantType === this.filterPlantType;

            // Show or hide graphic based on the filter match
            graphic.visible = matchesSoilType && matchesPlantType;
        }
    });

    console.log(
        `Filter applied: Soil Type = ${this.filterSoilType}, Plant Type = ${this.filterPlantType}`
    );
  }
}
