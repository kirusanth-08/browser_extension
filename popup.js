let formData = [];
let buttonData = [];
let currentTabId = null;
let recognition = null;
let isRecording = false;
let currentInputField = null;

// Initialize speech recognition
function initializeSpeechRecognition() {
  if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    
    recognition.onresult = function(event) {
      if (currentInputField && event.results[0].isFinal) {
        const transcript = event.results[0][0].transcript;
        currentInputField.value = transcript;
        
        // Update visual feedback
        const micButton = document.querySelector(`button[data-for-input="${currentInputField.id}"]`);
        if (micButton) {
          micButton.classList.remove('recording');
          micButton.innerHTML = '<i class="mic-icon">🎤</i>';
        }
      }
    };
    
    recognition.onend = function() {
      isRecording = false;
      // Update visual feedback
      const micButton = document.querySelector('.mic-button.recording');
      if (micButton) {
        micButton.classList.remove('recording');
        micButton.innerHTML = '<i class="mic-icon">🎤</i>';
      }
    };
    
    recognition.onerror = function(event) {
      console.error('Speech recognition error:', event.error);
      isRecording = false;
      // Update visual feedback
      const micButton = document.querySelector('.mic-button.recording');
      if (micButton) {
        micButton.classList.remove('recording');
        micButton.innerHTML = '<i class="mic-icon">🎤</i>';
      }
    };
    
    return true;
  } else {
    console.error('Speech recognition not supported in this browser');
    return false;
  }
}

// When the popup loads
document.addEventListener('DOMContentLoaded', function() {
  // Initialize speech recognition
  const speechRecognitionAvailable = initializeSpeechRecognition();
  
  // Get the current tab
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentTab = tabs[0];
    currentTabId = currentTab.id;
    
    // Request form and button data from the content script
    chrome.tabs.sendMessage(currentTabId, {action: "getForms"}, function(response) {
      document.getElementById('loading').style.display = 'none';
      
      if (response) {
        if (response.forms && response.forms.length > 0) {
          formData = response.forms;
          displayForms(formData, speechRecognitionAvailable);
          document.getElementById('forms-container').style.display = 'block';
          document.getElementById('apply-btn').disabled = false;
        } else {
          document.getElementById('no-forms').style.display = 'block';
        }
        
        if (response.buttons && response.buttons.length > 0) {
          buttonData = response.buttons;
          displayButtons(buttonData);
          document.getElementById('buttons-container').style.display = 'block';
        }
      } else {
        document.getElementById('no-forms').style.display = 'block';
      }
    });
  });
  
  // Set up button event listeners
  document.getElementById('apply-btn').addEventListener('click', applyValues);
  document.getElementById('reset-btn').addEventListener('click', resetForm);
});

function displayForms(forms, speechEnabled) {
  const formsContainer = document.getElementById('forms-container');
  formsContainer.innerHTML = '';
  
  forms.forEach((form, formIndex) => {
    const formSection = document.createElement('div');
    formSection.className = 'form-section';
    
    const formTitle = document.createElement('div');
    formTitle.className = 'form-title';
    formTitle.textContent = `Form ${formIndex + 1}${form.id ? ' (ID: ' + form.id + ')' : ''}`;
    formSection.appendChild(formTitle);
    
    form.fields.forEach(field => {
      const fieldDiv = document.createElement('div');
      fieldDiv.className = 'form-field';
      
      const label = document.createElement('label');
      label.textContent = field.label || field.name || field.id || 'Field';
      fieldDiv.appendChild(label);
      
      // Create input wrapper for text fields if speech is enabled
      const inputWrapper = document.createElement('div');
      inputWrapper.className = 'input-wrapper';
      
      let input;
      
      if (field.type === 'select') {
        input = document.createElement('select');
        field.options.forEach(option => {
          const optionEl = document.createElement('option');
          optionEl.value = option.value;
          optionEl.textContent = option.text;
          if (option.selected) {
            optionEl.selected = true;
          }
          input.appendChild(optionEl);
        });
      } else if (field.type === 'textarea') {
        input = document.createElement('textarea');
        input.value = field.value || '';
      } else if (field.type === 'checkbox' || field.type === 'radio') {
        input = document.createElement('input');
        input.type = field.type;
        input.checked = field.checked || false;
      } else {
        input = document.createElement('input');
        input.type = field.type || 'text';
        input.value = field.value || '';
        if (field.placeholder) {
          input.placeholder = field.placeholder;
        }
      }
      
      input.id = `form-${formIndex}-field-${field.index}`;
      input.dataset.formIndex = formIndex;
      input.dataset.fieldIndex = field.index;
      input.dataset.fieldType = field.type;
      
      // For text-based inputs, add to wrapper
      if ((field.type === 'text' || field.type === 'search' || field.type === 'email' || 
           field.type === 'password' || field.type === 'tel' || field.type === 'url' || 
           field.type === 'textarea' || !field.type) && speechEnabled) {
        
        inputWrapper.appendChild(input);
        
        // Add microphone button for voice input
        const micButton = document.createElement('button');
        micButton.type = 'button';
        micButton.className = 'mic-button';
        micButton.innerHTML = '<i class="mic-icon">🎤</i>';
        micButton.dataset.forInput = input.id;
        micButton.title = 'Click to use voice input';
        
        micButton.addEventListener('click', function() {
          startVoiceRecognition(input, micButton);
        });
        
        inputWrapper.appendChild(micButton);
        fieldDiv.appendChild(inputWrapper);
      } else {
        fieldDiv.appendChild(input);
      }
      
      formSection.appendChild(fieldDiv);
    });
    
    formsContainer.appendChild(formSection);
  });
}

function startVoiceRecognition(inputField, micButton) {
  if (!recognition) {
    alert('Speech recognition is not available in your browser');
    return;
  }
  
  // If already recording for another field, stop it
  if (isRecording) {
    recognition.stop();
    isRecording = false;
    // Reset previous button if exists
    const prevButton = document.querySelector('.mic-button.recording');
    if (prevButton) {
      prevButton.classList.remove('recording');
      prevButton.innerHTML = '<i class="mic-icon">🎤</i>';
    }
  }
  
  // Set current input field and start recording
  currentInputField = inputField;
  
  // Update visual feedback
  micButton.classList.add('recording');
  micButton.innerHTML = '<i class="mic-icon">⏺️</i>'; // Recording indicator
  
  // Start speech recognition
  try {
    recognition.start();
    isRecording = true;
  } catch (e) {
    console.error('Error starting speech recognition:', e);
    micButton.classList.remove('recording');
    micButton.innerHTML = '<i class="mic-icon">🎤</i>';
  }
}

function displayButtons(buttons) {
  const buttonsContainer = document.getElementById('buttons-container');
  
  const buttonTitle = document.createElement('div');
  buttonTitle.className = 'section-title';
  buttonTitle.textContent = 'Buttons';
  buttonsContainer.appendChild(buttonTitle);
  
  const buttonsList = document.createElement('div');
  buttonsList.className = 'buttons-list';
  
  buttons.forEach((button, index) => {
    const buttonEl = document.createElement('button');
    buttonEl.className = 'page-button';
    buttonEl.textContent = button.text || 'Button';
    buttonEl.dataset.buttonIndex = button.index;
    
    buttonEl.addEventListener('click', function() {
      clickPageButton(button.index);
    });
    
    buttonsList.appendChild(buttonEl);
  });
  
  buttonsContainer.appendChild(buttonsList);
}

function clickPageButton(buttonIndex) {
  chrome.tabs.sendMessage(currentTabId, {
    action: "clickButton",
    buttonIndex: buttonIndex
  }, function(response) {
    if (response && response.success) {
      // Optionally show success message
      console.log('Button clicked successfully');
      
      // Optionally close the popup after button click
      // window.close();
    }
  });
}

function applyValues() {
  const updatedValues = [];
  
  formData.forEach((form, formIndex) => {
    const formValues = { formIndex, fields: [] };
    
    form.fields.forEach(field => {
      const selector = `[data-form-index="${formIndex}"][data-field-index="${field.index}"]`;
      const inputElement = document.querySelector(selector);
      
      if (inputElement) {
        let value;
        if (inputElement.type === 'checkbox' || inputElement.type === 'radio') {
          value = inputElement.checked;
        } else {
          value = inputElement.value;
        }
        
        formValues.fields.push({
          index: field.index,
          value: value
        });
      }
    });
    
    updatedValues.push(formValues);
  });
  
  // Send updated values to the content script
  chrome.tabs.sendMessage(currentTabId, {
    action: "updateForms",
    formValues: updatedValues
  }, function(response) {
    if (response && response.success) {
      const applyBtn = document.getElementById('apply-btn');
      applyBtn.textContent = 'Applied!';
      setTimeout(() => {
        applyBtn.textContent = 'Apply Values';
      }, 1500);
    }
  });
}

function resetForm() {
  const formsContainer = document.getElementById('forms-container');
  
  // Reset all input values in the popup
  const inputs = formsContainer.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    if (input.type === 'checkbox' || input.type === 'radio') {
      input.checked = false;
    } else {
      input.value = '';
    }
  });
}