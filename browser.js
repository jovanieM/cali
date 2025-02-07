
// Define all UI elements
const webviewStack = document.getElementById('webviewStack');
const tabBar = document.getElementById('tabBar');
const navBar = document.getElementById('navBar');

const backButton = document.getElementById('backButton');
const forwardButton = document.getElementById('forwardButton');
const homeButton = document.getElementById('homeButton');
const printButton = document.getElementById('printButton');
const endSessionButton = document.getElementById('endSessionButton');

const webviewStackDOMData = [];

let activeTabModel;

let navbarIsOffscreen = false;
let navbarInactivityTimerId;

/*
poske@azure.capse-iss.com
?t?PdcjXLq7~3hq

TODO
- Add toast messages for info
- Update doc titles to come from messages
- configurable page refresh timer
*/

/*
  Default application settings. If no managed config,
  these are the settings the app will use.
*/
let applicationSettings = {
  // HomeURL: "https://www.google.com",
  HomeURL: "https://amazing-smooth-chasmosaurus.glitch.me/",
  // HomeURL: "https://app.powerbi.com/reportEmbed?reportId=bd6e60bb-b0b1-46dc-9267-b2d491aaad9c&autoAuth=true&ctid=a4e03498-adc8-405b-8125-b2fdf25b6931",
  SessionTimeout: 20,
  NavbarInactivityTimeout: 0,
  ShowBackButton: true,
  ShowForwardButton: true,
  ShowHomeButton: true,
  ShowPrintButton: true,
  ShowEndSessionButton: true,
  PartitionID: "keep_alive",
};

// id to track user interaction timeout function
let appInactivityTimerId;
// required for webview logic only needed on app startup
let firstWebviewLoad = true;

/***
  Application logic
***/
chrome.runtime.onMessage.addListener(
  function (request, sender, sendResponse) {
    // console.log('Message received:', request);
    if (request.type == 'activity') {
      activityMonitor(request.event);
    }
  }
);

function reloadPolicies() {
  chrome.storage.managed.get(function (policy) {
    if (!policy) {
      console.log("No managed config data provided. Using default settings");
    } else {
      console.log("Managed config detected", policy);
      applicationSettings = Object.assign(applicationSettings, policy);
    }

    console.log("Loading settings:", applicationSettings);

    /*
      The webview won't fire the clearData callback if
      it hasn't navigated anywhere - ex: it's a noop
      so we set the url directly here on startup and
      in the future when new policies are detected, 
      send it down the clear data path.
    */
    // if (firstWebviewLoad) {
    //   activeTabModel.webview.src = applicationSettings.HomeURL;
    //   firstWebviewLoad = false;
    // } else {
      resetSession();
    // }

    backButton.hidden = !applicationSettings.ShowBackButton;
    forwardButton.hidden = !applicationSettings.ShowForwardButton;
    printButton.hidden = !applicationSettings.ShowPrintButton;
    homeButton.hidden = !applicationSettings.ShowHomeButton;
    endSessionButton.hidden = !applicationSettings.ShowEndSessionButton;

    clearTimeout(navbarInactivityTimerId);
    clearTimeout(appInactivityTimerId);

    if (applicationSettings.NavbarInactivityTimeout <= 0) {
      navBar.classList.remove("offscreen");
      navbarIsOffscreen = false;
    }
  });
}

function addTab(url) {
  // Create all the new DOM elements we'll need
  let newWebview = document.createElement("webview");
  if (applicationSettings.PartitionID) {
    newWebview.partition = "persist:" + applicationSettings.PartitionID;
  }
  newWebview.src = url;

  let newTab = document.createElement("div");
  newTab.classList.add("tab");

  let newTabSiteName = document.createElement("span");
  newTabSiteName.textContent = "...";
  newTabSiteName.classList.add("site-name");
  newTab.appendChild(newTabSiteName);

  let newTabCloseBtn = document.createElement("button");
  newTabCloseBtn.classList.add("close-button");
  newTabCloseBtn.innerHTML = "<i class='material-icons-outlined'>close</i>"
  newTab.appendChild(newTabCloseBtn);

  let scopedTabModel = {
    tab: newTab,
    webview: newWebview
  };
  webviewStackDOMData.push(scopedTabModel);
  setActiveTab(scopedTabModel);

  /***
      Script injection for each webview to surface events 
  ***/
  newWebview.addContentScripts([
    {
      name: 'webview_manager',
      matches: ['https://*.com/*', 'https://*.me/*'],
      js: {
        files: ['content_scripts/webview_manager.js']
      }
    }
  ]);

  /***
      Event handles for tab
  ***/
  newTabCloseBtn.addEventListener("click", (e) => {
    console.log('close clicked');
    e.stopPropagation();

    newTab.remove();
    newWebview.remove();

    let tabToRemoveIdx = webviewStackDOMData.indexOf(scopedTabModel);
    if (scopedTabModel == activeTabModel) {
      if (tabToRemoveIdx == webviewStackDOMData.length - 1) {
        setActiveTab(webviewStackDOMData[tabToRemoveIdx - 1]);
      } else {
        setActiveTab(webviewStackDOMData[tabToRemoveIdx + 1]);
      }
    }

    webviewStackDOMData.splice(tabToRemoveIdx, 1);
    updateTabVisibility();
  });

  newTab.addEventListener("click", () => {
    setActiveTab(scopedTabModel);
  });

  newWebview.addEventListener('loadcommit', (e) => {
    if (scopedTabModel == activeTabModel) {
      backButton.disabled = !newWebview.canGoBack();
      forwardButton.disabled = !newWebview.canGoForward();
    }
    newWebview.executeScript(
      {
        code: 'document.title'
      },
      (docTitle) => {
        newTabSiteName.textContent = docTitle;
        newTabSiteName.title = docTitle;
      }
    );
  });

  newWebview.addEventListener('newwindow', (e) => {
    addTab(e.targetUrl);
  });

  // modify the DOM at the end of the function to reduce thrashing
  webviewStack.appendChild(newWebview);
  tabBar.appendChild(newTab);

  updateTabVisibility();
}

function setActiveTab(newTabModel) {
  if (activeTabModel) {
    activeTabModel.tab.classList.remove("active");
    activeTabModel.webview.classList.remove("active");
  }

  activeTabModel = newTabModel;

  activeTabModel.tab.classList.add("active");
  activeTabModel.webview.classList.add("active");

  backButton.disabled = !activeTabModel.webview.canGoBack();
  forwardButton.disabled = !activeTabModel.webview.canGoForward();
}

function updateTabVisibility() {
  if (webviewStackDOMData.length == 1) {
    tabBar.classList.add('hidden');
  } else {
    tabBar.classList.remove('hidden');
  }
}

function resetSession() {
  console.log('Resetting session');

  let lastWindow;
  addTab(applicationSettings.HomeURL);

  webviewStackDOMData.forEach((element, i) => {
    if (i == 0) {
      lastWindow = element;
      return;
    }
    element.tab.remove();
    element.webview.remove();
  });
  webviewStackDOMData.splice(1, webviewStackDOMData.length - 1);

  // setActiveTab(lastWindow);
  updateTabVisibility();

  lastWindow.webview.clearData(
    {},
    {
      appcache: true,
      cache: true,
      cookies: true,
      fileSystems: true,
      indexedDB: true,
      localStorage: true,
      persistentCookies: true,
      sessionCookies: true,
      webSQL: true
    },
    () => {
      console.log('Clear data completed');
      // lastWindow.webview.src = applicationSettings.HomeURL;
    }
  );
}

/*
  DOM Event Handlers
*/

document.addEventListener("DOMContentLoaded", function () {
  // addTab("");

  // Listen for policy updates.
  chrome.storage.managed.onChanged.addListener((changes) => {
    console.log("Config updated: " + changes);
    reloadPolicies();
  });
  // Load the initial app settings.
  reloadPolicies();

  /*
  DEBUG VERSION NUMBER
  */
  document.getElementById('debugVersion').textContent =
    `Version ${chrome.runtime.getManifest().version}`;

  activityMonitor();
});

document.addEventListener('mousemove', activityMonitor, { capture: true });
document.addEventListener('mousedown', activityMonitor, { capture: true });
document.addEventListener('touchstart', activityMonitor, { capture: true });
document.addEventListener('keydown', activityMonitor, { capture: true });
document.addEventListener('scroll', activityMonitor, { capture: true });

/*
  UI Function Handlers
*/
function activityMonitor(e) {
  console.log('activity detected' + (e ? ': ' + e.type : ''));

  clearTimeout(navbarInactivityTimerId);
  if (applicationSettings.NavbarInactivityTimeout > 0) {
    if (navbarIsOffscreen) {
      navBar.classList.remove("offscreen");
      navbarIsOffscreen = false;
    }
    navbarInactivityTimerId = setTimeout(
      () => {
        console.log("Navbar inactivity timeout detected");
        navBar.classList.add("offscreen");
        navbarIsOffscreen = true;
      },
      applicationSettings.NavbarInactivityTimeout * 1000);
  }

  clearTimeout(appInactivityTimerId);
  if (applicationSettings.SessionTimeout > 0) {
    appInactivityTimerId = setTimeout(
      () => {
        console.log("Inactivity timeout detected");
        resetSession();
      },
      applicationSettings.SessionTimeout * 1000);
  }
}

backButton.addEventListener('click', () => {
  activeTabModel.webview.back();
});

forwardButton.addEventListener('click', () => {
  activeTabModel.webview.forward();
});

homeButton.addEventListener('click', () => {
  activeTabModel.webview.src = applicationSettings.HomeURL;
});

printButton.addEventListener('click', () => {
  activeTabModel.webview.print();
});

endSessionButton.addEventListener('click', () => {
  resetSession();
});
