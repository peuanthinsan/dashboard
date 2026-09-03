export type GoogleMapsLatLngLiteral = {
  lat: number;
  lng: number;
};

export type GoogleMapsEventListener = {
  remove: () => void;
};

export type GoogleMapsMap = {
  fitBounds: (bounds: GoogleMapsLatLngBounds, padding?: number) => void;
  setCenter: (position: GoogleMapsLatLngLiteral) => void;
  setZoom: (zoom: number) => void;
};

export type GoogleMapsLatLngBounds = {
  extend: (position: GoogleMapsLatLngLiteral) => void;
};

export type GoogleMapsDrawable = {
  setMap: (map: GoogleMapsMap | null) => void;
};

export type GoogleMapsCircle = GoogleMapsDrawable & {
  addListener: (eventName: 'click', callback: () => void) => GoogleMapsEventListener;
};

export type GoogleMapsApi = {
  maps: {
    Map: new (
      element: HTMLElement,
      options: {
        center: GoogleMapsLatLngLiteral;
        clickableIcons?: boolean;
        fullscreenControl?: boolean;
        mapTypeControl?: boolean;
        streetViewControl?: boolean;
        zoom: number;
      },
    ) => GoogleMapsMap;
    LatLngBounds: new () => GoogleMapsLatLngBounds;
    Circle: new (options: {
      center: GoogleMapsLatLngLiteral;
      clickable?: boolean;
      fillColor: string;
      fillOpacity: number;
      map: GoogleMapsMap;
      radius: number;
      strokeColor: string;
      strokeOpacity: number;
      strokeWeight: number;
      zIndex?: number;
    }) => GoogleMapsCircle;
    Polyline: new (options: {
      geodesic?: boolean;
      map: GoogleMapsMap;
      path: GoogleMapsLatLngLiteral[];
      strokeColor: string;
      strokeOpacity: number;
      strokeWeight: number;
      zIndex?: number;
    }) => GoogleMapsDrawable;
    event: {
      clearInstanceListeners: (instance: object) => void;
    };
  };
};

const SCRIPT_ID = 'songdee-google-maps-js';
const READY_CALLBACK = '__songdeeGoogleMapsReady';
let loaderPromise: Promise<GoogleMapsApi> | null = null;

type GoogleMapsWindow = Window & {
  google?: GoogleMapsApi;
  __songdeeGoogleMapsReady?: () => void;
};

function getLoadedApi(): GoogleMapsApi | null {
  if (typeof window === 'undefined') return null;
  const google = (window as GoogleMapsWindow).google;
  return google?.maps?.Map ? google : null;
}

/** Load Google Maps once for the whole client, even when several dashboards mount together. */
export function loadGoogleMaps(apiKey: string): Promise<GoogleMapsApi> {
  const loadedApi = getLoadedApi();
  if (loadedApi) return Promise.resolve(loadedApi);
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Google Maps can only be loaded in a browser.'));
  }
  if (!apiKey) {
    return Promise.reject(new Error('Google Maps is not configured.'));
  }
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<GoogleMapsApi>((resolve, reject) => {
    const mapsWindow = window as GoogleMapsWindow;
    const deadline = Date.now() + 10_000;
    const existingScript =
      document.querySelector<HTMLScriptElement>(`#${SCRIPT_ID}`) ??
      document.querySelector<HTMLScriptElement>('script[src^="https://maps.googleapis.com/maps/api/js"]');
    const script = existingScript ?? document.createElement('script');

    let timeoutId: number | null = null;
    const cleanup = () => {
      if (timeoutId != null) window.clearTimeout(timeoutId);
      script.removeEventListener('error', fail);
      if (mapsWindow[READY_CALLBACK] === finish) delete mapsWindow[READY_CALLBACK];
    };
    const finish = () => {
      const api = getLoadedApi();
      if (api) {
        cleanup();
        resolve(api);
        return;
      }
      cleanup();
      loaderPromise = null;
      reject(new Error('Google Maps loaded without an available maps API.'));
    };
    const fail = () => {
      cleanup();
      loaderPromise = null;
      if (!existingScript) script.remove();
      reject(new Error('Google Maps could not be loaded.'));
    };

    script.addEventListener('error', fail, { once: true });

    if (!existingScript) {
      mapsWindow[READY_CALLBACK] = finish;
      script.id = SCRIPT_ID;
      script.async = true;
      script.defer = true;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&v=weekly&callback=${READY_CALLBACK}`;
      document.head.appendChild(script);
    } else {
      const waitForExistingApi = () => {
        const api = getLoadedApi();
        if (api) {
          cleanup();
          resolve(api);
          return;
        }
        if (Date.now() >= deadline) {
          fail();
          return;
        }
        timeoutId = window.setTimeout(waitForExistingApi, 50);
      };
      timeoutId = window.setTimeout(waitForExistingApi, 0);
    }
  });

  return loaderPromise;
}
