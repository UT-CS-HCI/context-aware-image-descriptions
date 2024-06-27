// inject button into webpage to open extension on user click
const button = document.createElement('button');
button.textContent = 'Describe images';
button.style.padding = '0.375rem 0.75rem';
button.style.margin = '10rem 10rem';
button.style.font = 'Inter';
button.style.fontSize = '1rem';
button.style.fontWeight = '500';
button.style.lineHeight = '1.5';
button.style.color = '#ffffff'; 
button.style.backgroundColor = '#007bff';
button.style.border = '1px solid #007bff'; 
button.style.borderRadius = '0.25rem';

button.onmouseover = function() {
    this.style.backgroundColor = '#0056b3';
};
button.onmouseout = function() {
    this.style.backgroundColor = '#007bff';
};
document.body.insertBefore(button, document.body.firstChild);

button.addEventListener('click', function() {
  chrome.runtime.sendMessage({action: "openWindow"});
});

// getting active tab information
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
      if (request.message === "getTabInfo") {
        chrome.runtime.sendMessage({ message: "tabInfo", data: {url: window.location.href, title: document.title} });
      }
    }
  );

// get selected image from webpage
document.body.addEventListener('click', function(e) {
    if (e.target.tagName === 'IMG') {
        if (!e.target.classList.contains('enlargeable') && !e.target.hasAttribute('onclick')) {
            e.preventDefault();
            e.stopPropagation();
            const imgDetails = {
                src: e.target.src,
                alt: e.target.alt || '',
                width: e.target.width,
                height: e.target.height,
                id: e.target.id || '',
            };
            chrome.runtime.sendMessage({action: "imageClicked", data: imgDetails, windowURL: window.location.href});
        }
    }
}, true); 

// get page title
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
      if (request.action === "getPageTitle") {
        chrome.runtime.sendMessage({ message: "pageTitle", data: {title: document.title} });
      }
    }
  );

  // get context
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.action === "getContext") {
      let textElements = document.querySelectorAll('p, span, h1, h2, h3, h4, h5, h6, a');
      var texts = [];
      for (i = 0; i < textElements.length; i++) {
        texts.push(textElements[i].innerHTML);
    }
      chrome.runtime.sendMessage({ message: "context", data: texts});
    }
  }
);

  // get scores for layout, tag, and similarity
  chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
      if (request.action === "getLayoutTagScores") {
        const imageURL = request.image.src;
        const baseURL = imageURL.includes('?') ? imageURL.split('?')[0] : imageURL;
        
        const imgElement = findImageElementByUrl(baseURL)
        
        if (imgElement) {
            let imgRect = imgElement.getBoundingClientRect();
            let imageCentroid = getImageCentroid(imgRect);
            let textElements = document.querySelectorAll('p, span, h1, h2, h3, h4, h5, h6, a');
            
            let elementsMap = new Map();
            
            let totalCharacters = 0;
            let totalWords = 0;

            textElements.forEach(element => {
              let text = element.textContent || element.innerText;
              totalCharacters += text.length;
              totalWords += text.split(/\s+/).filter(word => word.length > 0).length;
          });

          console.log('Total Characters:', totalCharacters);
          console.log('Total Words:', totalWords);
            
            textElements.forEach(element => {
            let textRect = element.getBoundingClientRect();
            let textContent = element.textContent.trim();
            let textPosition = textRect.bottom <= imgRect.top ? 'top' :
                                textRect.top >= imgRect.bottom ? 'bottom' :
                                textRect.left >= imgRect.right ? 'right' :
                                textRect.right <= imgRect.left ? 'left' : '';
            
            
            if (textPosition) {
                let distance = getShortestDistance(imageCentroid, textRect, textPosition);
                if (distance !== null) {
                if (!elementsMap.has(textContent) || elementsMap.get(textContent).shortDist > distance) {
                    elementsMap.set(textContent, {
                    'text': textContent,
                    'tag': element.tagName.toLowerCase(),
                    'shortDist': distance,
                    'boundingBox': {
                        'left': textRect.left,
                        'top': textRect.top,
                        'width': textRect.width,
                        'height': textRect.height
                    },
                    'layout': textPosition,
                    'layout_score': layoutScores[textPosition] 
                    });
                }
                }
            }
            });
        
            let distances = Array.from(elementsMap.values()).map(entry => entry.shortDist);
            let maxDist = Math.max(...distances);
            let minDist = Math.min(...distances);
        
            // Add dist_score to each entry
            elementsMap.forEach((entry, key) => {
            entry.dist_score = calculateDistScore(entry, maxDist, minDist);
            elementsMap.set(key, entry);
            });
        
            let scoreJSON = Array.from(elementsMap.values());
            chrome.runtime.sendMessage({ message: "layoutTagScores", data: scoreJSON});
            } else {
                console.log('Image with the specified URL was not found.');
            }
      }
    }
  );

const layoutScores = {
    "top": 0.8,
    "bottom": 0.8,
    "right": 0.9,
    "left": 0.9
  };
  
  function getImageCentroid(imgRect) {
    return {
      x: imgRect.left + imgRect.width / 2,
      y: imgRect.top + imgRect.height / 2,
    };
  }
  
  function getShortestDistance(imageCentroid, textRect, textPosition) {
    switch (textPosition) {
      case 'right': return textRect.left - imageCentroid.x;
      case 'left': return imageCentroid.x - textRect.right;
      case 'top': return imageCentroid.y - textRect.bottom;
      case 'bottom': return textRect.top - imageCentroid.y;
      default: return null;
    }
  }
  
  function calculateDistScore(entry, maxDist, minDist) {
    if (maxDist === minDist) return 1;
    return (maxDist - entry.shortDist) / (maxDist - minDist);
  }
  
  function findImageElementByUrl(imageUrl) {
    const imgs = document.querySelectorAll('img');
    for (let img of imgs) {
        const imgSrc = img.src ? img.src.split('?')[0] : null;
        const imgAttributeSrc = img.getAttribute('src') ? img.getAttribute('src').split('?')[0] : null;

        if (imgSrc === imageUrl || imgAttributeSrc === imageUrl || img.src === imageUrl) {
            return img;
        }
    }
    return null;
}

// inject description into webpage as figcaption
function injectDescription(image, description) {
  let figure = image.closest('figure');
  let figcaption;

  if (figure) {
    // Figure exists, find or create figcaption
    figcaption = figure.querySelector('figcaption') || document.createElement('figcaption');
    if (!figcaption.parentNode) {
        figure.appendChild(figcaption);
        figcaption.style.color = 'green'; // Set initial color to green
    }
    
    // Append the additional description and set its color to red
    if (figcaption.textContent) {
        const finalDescriptionSpan = document.createElement('span');
        finalDescriptionSpan.textContent += ' \n' + description;
        finalDescriptionSpan.style.color = 'red';  // Set text color to red for appended text
        figcaption.appendChild(finalDescriptionSpan);
    } else {
        figcaption.textContent = description;
    }
  } else {
    figure = document.createElement('figure');
    image.parentNode.insertBefore(figure, image);
    figure.appendChild(image);

    figcaption = document.createElement('figcaption');
    figcaption.textContent = description; // Set the initial text content
    figcaption.style.color = 'green'; // Set text color to green for new text
    figure.appendChild(figcaption);    }
    figcaption.style.fontSize = '12px'; 
}

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.action === "injectDescription")   {
      const source = request.image.src; 
      const imageDescription = request.data; 
      const images = document.getElementsByTagName('img');
      for (let image of images) {
          if (image.src === source) {
              injectDescription(image, imageDescription);
              break; 
          }
      }
    }
  });