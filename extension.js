// get active tab information
document.addEventListener('DOMContentLoaded', function() {
    chrome.tabs.query({active: true}, function(tabs) {
        if (tabs[0].url.match('https:\/\/.*.*.*\/.*')) {
          chrome.tabs.sendMessage(tabs[0].id, { message: "getTabInfo" });
          chrome.runtime.onMessage.addListener(
            function(request, sender, sendResponse) {
            if (request.message === "updateTabInfo") {
                updateTabInfo(request.data);
                } 
            });
        }
    })
})

// update tab information
function updateTabInfo(tab) {
    document.getElementById('pageTitle').innerHTML = `${tab.title}`;
    document.getElementById('pageLink').innerHTML = `<a href="${tab.url}" target="_blank">Page link</a>`;
  }

// update selected image and source
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "displayImage") {
        const displayArea = document.getElementById('displayArea'); 
        imageLink.innerHTML = `<a href="${message.data.src}" target="_blank">Selected image link</a>`
        displayArea.innerHTML = `<img src="${message.data.src}" style="max-width: 100%; height: auto;">`;
        let selectedImage = message.data;
        getWebProfile(selectedImage)
    }
});

// get web profile: domain, category, purpose 
function getWebProfile(selectedImage) {
    chrome.runtime.sendMessage({ message: 'getWebProfile', data: selectedImage });    
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.message === "webProfile") {
            let webProfile = request.data;
            getBaselineDescription1 (selectedImage)
            getBaselineDescription2 (selectedImage)
            getCandidateDescription(selectedImage, webProfile)
        }
    })
}

// long baseline description 1 (no page context) 
function getBaselineDescription1 (selectedImage) {
    chrome.runtime.sendMessage({ message: 'getBaselineDescription1', data: selectedImage });    
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.message === "baselineDescription1") {
            let bd1 = request.data;
            const baselineDescription1 = document.getElementById('baselineDescription1'); 
            baselineDescription1.innerHTML = `${bd1}`
            baselineDescription1.style.display === "none";
            getCondensedBase1(bd1)
        }
    })
}

// shortened baseline description 1 (no page context) 
function getCondensedBase1 (baselineDescription1) {
    chrome.runtime.sendMessage({ message: 'getCondensedBase1', data: baselineDescription1 });    
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.message === "condensedBase1") {
            let condensedBase1 = request.data;
            const cb1 = document.getElementById('condensedBase1'); 
            cb1.innerHTML = `${condensedBase1}`
        }
    })
}

// get baseline description 2
function getBaselineDescription2 (selectedImage) {
    chrome.tabs.query({active: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "getContext"});
    });
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.message === "htmlContext") {
            let context = request.data;
            chrome.runtime.sendMessage({ message: 'getBaselineDescription2', data: context, image: selectedImage });    
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                if (request.message === "baselineDescription2") {
                    let bd2 = request.data;
                    //const baselineDescription2 = document.getElementById('baselineDescription2'); 
                    //baselineDescription2.innerHTML = `Baseline description 2: ${bd2}`
                    getCondensedBase2(bd2)
                }
            })
        }
    })
}

// get condensed baseline description 1
function getCondensedBase2 (baselineDescription2) {
    chrome.runtime.sendMessage({ message: 'getCondensedBase2', data: baselineDescription2 });    
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.message === "condensedBase2") {
            let condensedBase2 = request.data;
            //const cb2 = document.getElementById('condensedBase2'); 
            //cb2.innerHTML = `Concise baseline description 2: ${condensedBase2}`
        }
    })
}

// get candidate descriptions
function getCandidateDescription (selectedImage, webProfile) {
    chrome.runtime.sendMessage({ message: 'getCandidateDescription', data: webProfile, image: selectedImage });    
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if(request.message === "vcw" && request.data) {
            const vcwJSON = request.data;
            getParameterScores (selectedImage);
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                if(request.message == "scores" && request.data) {
                    const layoutTagScores = request.data;
                    getClipScores(selectedImage, webProfile, vcwJSON, layoutTagScores)
                }
            })
        }
    })
}

function getParameterScores(selectedImage) {
    chrome.tabs.query({active: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "getLayoutTagScores", image: selectedImage });
    });
}

// clip scores for text-image similarity
function getClipScores (selectedImage, webProfile, vcwJSON, layoutTagScores) {
    const requestData = {
        scores: layoutTagScores, 
        imageUrl: selectedImage.src 
    };
    console.log("Fetching CLIP scores now.")
   // fetch('http://127.0.0.1:5000/clip-scores', {
    fetch('https://ananyagm-context-informed-descriptions.hf.space', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
            })
            .then(response => response.json())
            .then(data => {
                chrome.runtime.sendMessage({ message: 'getFinalScores', clipLayoutTagScores: data, image: selectedImage, webProfile: webProfile, vcwJSON: vcwJSON });    
            })
            .catch((error) => {
                console.error('Error:', error);
            });
}

// final candidate description long
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === "finalDescription") {
        const candidate1 = document.getElementById('candidateDescription'); 
        candidate1.innerHTML = request.data;
        candidate1.style.display === "none";
        selectedImage = request.image;
        //injectDescription (request.data, selectedImage)
    }
});

// final candidate description short
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === "conciseDescription") {
        const candidate2 = document.getElementById('conciseCandidate'); 
        candidate2.innerHTML = request.data;
        selectedImage = request.image;
        //injectDescription (request.data, selectedImage)
    }
});

// show/hide long baseline 1 description
document.getElementById("baseDetailed").addEventListener("click", showHideLongBaseDescription);

function showHideLongBaseDescription() {
    var x = document.getElementById("longBaseDescription");
    if (x.style.display === "none") {
        x.style.display = "block";
    } else {
        x.style.display = "none";
    }
}

// show/hide long candidate description
document.getElementById("candidateDetailed").addEventListener("click", showHideLongCandidateDescription);

function showHideLongCandidateDescription() {
    var y = document.getElementById("longCandidateDescription");
    if (y.style.display === "none") {
        y.style.display = "block";
    } else {
        y.style.display = "none";
    }
}

// inject descriptions into webpage
function injectDescription (description, selectedImage) {
    chrome.tabs.query({active: true}, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "injectDescription", data: description, image: selectedImage})
    })
}

