import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getDatabase, ref, set, update, query, orderByChild, equalTo, get } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';

let iterator = 0;
let conciseCandidateDescriptions = [];
let detailedCandidateDescriptions = [];

// firebase configuration
const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  databaseURL: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
  measurementId: ""
};

// firebase initialization
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

function generateRandomFiveDigitNumber() {
  return Math.floor(Math.random() * (99999 - 10000 + 1)) + 10000;
}

const imageId = generateRandomFiveDigitNumber();
const reference = ref(database, 'imageDescriptions/' + imageId);

// text + no image gpt4v api
async function getTexualInfoAPI (prompt) {
  const openaiEndpoint = 'https://api.openai.com/v1/chat/completions';
  const openaiApiKey = '';
  const response = await fetch(openaiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt},
          ],
        },
      ],
      max_tokens: 3000,
    }),
  });

  const responseData = await response.json();
  return responseData.choices[0].message.content;
}

// image + text gpt4v api
async function getVisualInfoAPI (imageURL, prompt) {
  const openaiEndpoint = 'https://api.openai.com/v1/chat/completions'; 
  const openaiApiKey = '';
  const response = await fetch(openaiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageURL }}
          ],
        },
      ],
      max_tokens: 3000,
    }),
  });

  const responseData = await response.json();
  return responseData.choices[0].message.content;
}

// open new window for chrome extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "openWindow") {
      chrome.windows.create({
        url: chrome.runtime.getURL("extension.html"),
        type: "popup",
        width: 600,
        height: 900
      }, (newWindow) => {
        console.log(`Window ID: ${newWindow.id}`);
      });
    }
  });

// sending extension.js tab information
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
      if (request.message === "tabInfo") {
        chrome.runtime.sendMessage({ message: "updateTabInfo", data: request.data });
      }
    }
  );

// sending extension.js selected image information
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "imageClicked") {
        const image_url = message.data.src;
        const webpage_url = message.windowURL;
        const imageDescriptionsRef = ref(database, 'imageDescriptions');
        const q = query(imageDescriptionsRef, orderByChild('image_url'), equalTo(image_url));
  
        get(q).then(snapshot => {
          if (snapshot.exists()) {
            snapshot.forEach(childSnapshot => {
              const recordNumber = childSnapshot.key;
              const data = childSnapshot.val();
              if (data.image_url === image_url && data.webpage_url === webpage_url) {
                console.log(`Record found: ${recordNumber}. Image URL and webpage URL match.`);
               chrome.runtime.sendMessage({action: "displayExistingImageRecord", data: record, selectedImage: message.data});
              } else {
                console.log(`Record found: ${recordNumber}, but URLs do not match.`);
              }
            });
          } else {
            console.log("No matching record found.");
            chrome.runtime.sendMessage({action: "displayImage", data: message.data});
          }
        }).catch(error => {
          console.error("Error querying database:", error);
        });
    }
  });

// web profile: domain, category, purpose 
chrome.runtime.onMessage.addListener(
    async function(request, sender, sendResponse) {
      if (request.message === 'getWebProfile' && request.data) {
        const prompt =  `Identify the domain of the web link, determine the category of the webpage in [ecommerce, news, educational, 
        social media, entertainment, lifestyle, dating, job portals, or services] and the purpose of the website in short. Return the result only in a JSON 
        format of '{"website": "name of the website", "category": "name of category", "purpose": "purpose of the website" }' with no additional text.` + request.data.src;
        const response =  await getTexualInfoAPI(prompt);
        const profile = JSON.parse(response);
        console.log("Webprofile ", profile)
        chrome.runtime.sendMessage({ message: 'webProfile', data: profile});
      }
    })

// get baseline description 1
chrome.runtime.onMessage.addListener(
  async function(request, sender, sendResponse) {
    if (request.message === 'getBaselineDescription1' && request.data) {
      const prompt = `Describe the image for blind and low-vision users.`
      const baselineDescription1=  await getVisualInfoAPI(request.data.src, prompt)
        chrome.runtime.sendMessage({ message: 'baselineDescription1', data: baselineDescription1 });
      }
    }
  )

  // condensed baseline description 1
chrome.runtime.onMessage.addListener(
  async function(request, sender, sendResponse) {
    if (request.message === 'getCondensedBase1' && request.data) {
      const prompt = `Refine the image description to make it more concise. \n` + request.data;
      const condensedBase1=  await getTexualInfoAPI(prompt)
      if (condensedBase1) {
        chrome.runtime.sendMessage({ message: 'condensedBase1', data: condensedBase1 });
      }
    }
  })

  // HTML context
  chrome.runtime.onMessage.addListener(  
    async function(request, sender, sendResponse) {
      if (request.message === "context") {
        chrome.runtime.sendMessage({ message: 'htmlContext', data: request.data });
      }
  })

// get baseline description 2
chrome.runtime.onMessage.addListener(
  async function(request, sender, sendResponse) {
    if (request.message === 'getBaselineDescription2' && request.data) {
      const prompt = `Describe the image for blind and low-vision users using the context. \n` + request.data;
      const baselineDescription2 =  await getVisualInfoAPI(request.image.src, prompt)
        chrome.runtime.sendMessage({ message: 'baselineDescription2', data: baselineDescription2 });
      }
    }
  )

// condensed baseline description 1
chrome.runtime.onMessage.addListener(
  async function(request, sender, sendResponse) {
    if (request.message === 'getCondensedBase2' && request.data) {
      const prompt = `Refine the image description to make it more concise. \n` + request.data;
      const condensedBase2=  await getTexualInfoAPI(prompt)
      if (condensedBase2) {
        chrome.runtime.sendMessage({ message: 'condensedBase2', data: condensedBase2 });
      }
    }
  })

// get visually concrete words from visual description, page title, and image alt text
chrome.runtime.onMessage.addListener(
    async function(request, sender, sendResponse) {
      if (request.message === 'getCandidateDescription' && request.data && request.image) {
        const selectedImage = request.image;
        const webProfile = request.data;
        const prompt =  `Describe the visual details of the element(s) in focus in the image for blind and low-vision users to reinforce the purpose of the webpage. ` + webProfile.purpose;
        const visualDetailsDescription =  await getVisualInfoAPI(selectedImage.src, prompt);
        console.log("Visual detail description\n", visualDetailsDescription)
        const vcwDescription = await getVisuallyConcreteWords (visualDetailsDescription, request.image);
        const imageAlt = request.image.alt;
        const vcwAlt = await getVisuallyConcreteWords (imageAlt, request.image);
        chrome.tabs.query({active: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "getPageTitle" });
        });
        chrome.runtime.onMessage.addListener( 
            async function(request, sender, sendResponse)  {
                if (request.message === "pageTitle") { 
                    const pageTitle = request.data;
                    const vcwTitle = await getVisuallyConcreteWords (pageTitle, selectedImage);
                    let vcwTitleJSON = JSON.parse(vcwTitle)
                    let vcwAltJSON = JSON.parse(vcwAlt)
                    let vcwDescriptionJSON = JSON.parse(vcwDescription)
                    const vcwJSON = [...vcwDescriptionJSON, ...vcwAltJSON, ...vcwTitleJSON]
                    chrome.runtime.sendMessage({message: "vcw", data: vcwJSON, image: selectedImage, webProfile: webProfile})
            }
        })
      }
    })

// 
async function getVisuallyConcreteWords (text, selectedImage) {
    const prompt = `Identify all the visually concrete words and their attributes from the text. Verify if the visually concrete words can be associated with elements in the image. Return the result only in an array of JSON, in the format of [{vcw: "visually concrete word", element: "element associated with the visually concrete word"}] with no additional text such as starting with '''json'''. If no visually concrete words are present, return an empty JSON. \n` + text;
    const vcwJSON = await getVisualInfoAPI(selectedImage.src, prompt);
    console.log("VCW from alt text, page title, initial visual description\n\n", vcwJSON)
    return vcwJSON;
}

chrome.runtime.onMessage.addListener ((request, sender, sendResponse) => {
    if (request.message === 'layoutTagScores'){
      chrome.runtime.sendMessage({message: "scores", data: request.data})
    }
  })

  // calculating final score based on clip, layout, and tag scores 
  chrome.runtime.onMessage.addListener (
    async function(request, sender, sendResponse)  {
      if (request.message === 'getFinalScores') {
        const selectedImage = request.image;
        const clipLayoutTagScores = request.clipLayoutTagScores;
        const vcwJSON = request.vcwJSON;
        const finalScores = clipLayoutTagScores.filter(entry => entry.clip_score > 0.001);
        finalScores.forEach(entry => {
          entry.final_score = 0.4 * entry.dist_score + 0.55 * entry.clip_score + 0.05* entry.layout_score;
        });
        console.log("Final scores\n", finalScores)
        getContextVCW(selectedImage, finalScores, vcwJSON)
      }
  })

async function getContextVCW(selectedImage, finalScores, vcwAltDescription) {
  const prompt = `Identify all the visually concrete words and their associated elements from the "text" field in the given JSON. If there are people/named entities present in the image, obtain their names from the highest "final_score" in the JSON. Verify if the visually concrete words can be associated with elements in the image. The score of the visually concrete word is the "final_score" field from which it is derived. Return the result only in JSON object in format of '[{vcw: "visually concrete word", element: "element associated with the visually concrete word", score: "final_score"}]' with no additional text. If no visually concrete words are present, return an empty JSON.  \n` + JSON.stringify(finalScores);
  const vcwContextJSON = await getVisualInfoAPI (selectedImage.src, prompt);
  console.log("VCW from context\n\n", vcwContextJSON)
  let vcw = JSON.parse(vcwContextJSON)
  let vcwScoreJson = [ ...vcw, ...vcwAltDescription]
  getFinalVCW(selectedImage, vcwScoreJson,  finalScores, vcwAltDescription);
}

async function getFinalVCW(selectedImage, vcwScoreJson, finalScores, vcwAltDescription) {
  const prompt = `Combine the visually concrete words that are associated with same elements, retain the score for the element if any entry for that element has a score. Keep all the named entities used to describe the elements. Return the result only in an array of JSON, with no additional text such as starting with '''json'''. If no similar elements are present, return the original JSON. \n` + JSON.stringify(vcwScoreJson);
  const finalVCW = await getTexualInfoAPI(prompt)
  console.log("Combined VCW\n", finalVCW)
  getCandidateDescription(selectedImage, JSON.parse(finalVCW), finalScores, vcwAltDescription) 
}

async function getCandidateDescription(selectedImage, vcw, finalScores, vcwAltDescription) {
  const promptA = `Generate a new JSON object from the given JSON by discarding entries whose "element" field is "none" or "not present". Return only the JSON with no additional text such as starting with '''json'''` + JSON.stringify(vcw)
  const finalVCW = await getVisualInfoAPI (selectedImage.src, promptA);
  console.log("Final VCW: ", finalVCW)
  const promptB = `If the names of person/people are known, only then assign {M, N, O, P...} (depending on the number of people in the image) to every person and return a JSON in the following structure: [{"placeholder": letter assigned to the name}, {"name": name of the person replaced}] with no additional texts. If there are no people, return an empty JSON. \n` + finalVCW;
  const peopleVCW = await getVisualInfoAPI (selectedImage.src, promptB);
  console.log("People VCW\n", peopleVCW)
  const promptC = `Describe the elements in focus in the image and their visual details for blind and low-vision users using all their visually concrete words (vcw) from the given JSON. If there is/are person/people in the image, refer to them in the description with the placeholder letters as given.  If there are no people in the image or their names are not present in the JSON, return the image description as is.`+ JSON.stringify(peopleVCW) +` Use the "scores" field to determine the priority of elements in the image to describe, higher score means higher priority to describe the element with its details. The goal is to make the image description specific and relevant. Return only the image description.\n` + JSON.stringify(finalVCW);
  const finalDescriptionA = await getVisualInfoAPI (selectedImage.src, promptC);
  console.log("Final description A (long): \n", finalDescriptionA)
  const promptD = `If there is/are person/people in the image, replace the "placeholder" letters in the description with the corresponding "name" from the JSON. Ensure that the description is semantically and gramatically correct and return only the description. If there are no people in the image or their names are not present in the JSON, return the image description as is.  \n` + JSON.stringify(peopleVCW) + `\nDescription: \n` + finalDescriptionA;
  const finalDescriptionB = await getTexualInfoAPI(promptD)
  console.log("Final description B (long):\n ", finalDescriptionB)
  getConciseCandidateDescription (selectedImage, finalDescriptionA, finalDescriptionB, peopleVCW, finalScores, vcwAltDescription);
}

async function getConciseCandidateDescription (selectedImage, finalDescriptionA, finalDescriptionB, peopleVCW, finalScores, vcwAltDescription) {
  const promptA = `Refine the image description to make it more concise. If there is/are person/people in the image, replace the "placeholder" letters in the description with the corresponding "name" from the JSON. Ensure that the description is semantically and gramatically correct and return only the description.  If there are no people in the image or their names are not present in the JSON, return the image description as is.\n` + JSON.stringify(peopleVCW) + `\nDescription: \n` +  finalDescriptionA;
  const conciseDescriptionA = await getVisualInfoAPI(selectedImage.src, promptA)
  console.log("Concise description A: \n", conciseDescriptionA)
  const promptB = `If there is/are person/people in the image, replace the "placeholder" letters in the description with the corresponding "name" from the JSON and return only the image description. If there are no people in the image or their names are not present in the JSON, return the image description as is. \n` + JSON.stringify(peopleVCW) + `\nDescription: \n` + conciseDescriptionA;
  const conciseDescriptionB = await getTexualInfoAPI(promptB)
  console.log("Concise description B: \n", conciseDescriptionB)
  if(iterator<4){
    detailedCandidateDescriptions.push(finalDescriptionB)
    conciseCandidateDescriptions.push(conciseDescriptionB)
    iterator+=1;
    if(iterator!=4) getContextVCW(selectedImage, finalScores, vcwAltDescription)
  }
    
  if (iterator === 4) {
    pickDescriptions (selectedImage, detailedCandidateDescriptions, conciseCandidateDescriptions) 
  }
}

async function pickDescriptions  (selectedImage, detailedCandidateDescriptions, conciseCandidateDescriptions) {
  const prompt = "Choose the best description in `detailedCandidateDescriptions` array based on highest number of named entites (such as names of people, location, objects), visual details, and objectivity. Return only the index number of the best description once selected. \n " + detailedCandidateDescriptions
  const index = await getVisualInfoAPI(selectedImage.src, prompt)
  const detailedFinal = detailedCandidateDescriptions[index]
  const conciseFinal = conciseCandidateDescriptions[index]
  chrome.runtime.sendMessage({message: "finalDescription", data: detailedFinal, image: selectedImage})
  chrome.runtime.sendMessage({message: "conciseDescription", data: conciseFinal, image: selectedImage})
}