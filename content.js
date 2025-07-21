// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "getForms") {
    const data = {
      forms: extractFormData(),
      buttons: extractButtonData()
    };
    sendResponse(data);
  } else if (request.action === "updateForms") {
    applyFormValues(request.formValues);
    sendResponse({success: true});
  } else if (request.action === "clickButton") {
    const success = clickButton(request.buttonIndex);
    sendResponse({success: success});
  }
  return true; // Keep the message channel open for async responses
});

// Extract all forms and their fields from the page
function extractFormData() {
  const forms = document.querySelectorAll('form');
  const formData = [];
  
  forms.forEach((form, formIndex) => {
    const formInfo = {
      index: formIndex,
      id: form.id || null,
      name: form.name || null,
      action: form.action || null,
      fields: []
    };
    
    // Get all input elements
    const inputs = form.querySelectorAll('input, select, textarea');
    
    inputs.forEach((input, fieldIndex) => {
      // Skip hidden, submit, button, and image inputs
      if (input.type === 'hidden' || input.type === 'submit' || 
          input.type === 'button' || input.type === 'image' || 
          input.style.display === 'none') {
        return;
      }
      
      const fieldInfo = {
        index: fieldIndex,
        id: input.id || null,
        name: input.name || null,
        type: input.type || 'text',
        value: input.value || '',
        placeholder: input.placeholder || ''
      };
      
      // Get the label for this input
      const labelElement = findLabel(input);
      if (labelElement) {
        fieldInfo.label = labelElement.textContent.trim();
      }
      
      // Handle different input types
      if (input.type === 'checkbox' || input.type === 'radio') {
        fieldInfo.checked = input.checked;
      }
      
      // Handle select elements
      if (input.tagName.toLowerCase() === 'select') {
        fieldInfo.type = 'select';
        fieldInfo.options = [];
        
        Array.from(input.options).forEach((option, optionIndex) => {
          fieldInfo.options.push({
            value: option.value,
            text: option.textContent,
            selected: option.selected
          });
        });
      }
      
      formInfo.fields.push(fieldInfo);
    });
    
    // Only add forms that have fields
    if (formInfo.fields.length > 0) {
      formData.push(formInfo);
    }
  });
  
  // If no forms with explicit <form> tags, look for implicit forms
  if (formData.length === 0) {
    const inputs = document.querySelectorAll('input, select, textarea');
    
    if (inputs.length > 0) {
      const implicitForm = {
        index: 0,
        id: null,
        name: 'Implicit Form',
        fields: []
      };
      
      inputs.forEach((input, fieldIndex) => {
        // Skip hidden, submit, button, and image inputs
        if (input.type === 'hidden' || input.type === 'submit' || 
            input.type === 'button' || input.type === 'image' || 
            input.style.display === 'none') {
          return;
        }
        
        const fieldInfo = {
          index: fieldIndex,
          id: input.id || null,
          name: input.name || null,
          type: input.type || 'text',
          value: input.value || '',
          placeholder: input.placeholder || ''
        };
        
        // Get the label for this input
        const labelElement = findLabel(input);
        if (labelElement) {
          fieldInfo.label = labelElement.textContent.trim();
        }
        
        // Handle different input types
        if (input.type === 'checkbox' || input.type === 'radio') {
          fieldInfo.checked = input.checked;
        }
        
        // Handle select elements
        if (input.tagName.toLowerCase() === 'select') {
          fieldInfo.type = 'select';
          fieldInfo.options = [];
          
          Array.from(input.options).forEach((option, optionIndex) => {
            fieldInfo.options.push({
              value: option.value,
              text: option.textContent,
              selected: option.selected
            });
          });
        }
        
        implicitForm.fields.push(fieldInfo);
      });
      
      // Only add if there are fields
      if (implicitForm.fields.length > 0) {
        formData.push(implicitForm);
      }
    }
  }
  
  return formData;
}

// Extract all buttons from the page
function extractButtonData() {
  const buttons = [];
  
  // Get all button elements
  const buttonElements = document.querySelectorAll('button, input[type="submit"], input[type="button"], .btn, [role="button"]');
  
  buttonElements.forEach((button, index) => {
    if (isVisible(button)) {
      let buttonText = '';
      
      // For input elements, use value as text
      if (button.tagName.toLowerCase() === 'input') {
        buttonText = button.value || button.placeholder || button.name || 'Button';
      } else {
        // For other elements, use textContent
        buttonText = button.textContent.trim();
        if (!buttonText) {
          // If no text, try to find an aria-label or title
          buttonText = button.getAttribute('aria-label') || 
                      button.getAttribute('title') || 
                      button.getAttribute('name') ||
                      'Button';
        }
      }
      
      buttons.push({
        index: index,
        text: buttonText,
        id: button.id || null,
        name: button.name || null,
        type: button.type || 'button',
        formId: button.form ? button.form.id : null
      });
    }
  });
  
  return buttons;
}

// Check if an element is visible
function isVisible(element) {
  return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length) && 
         window.getComputedStyle(element).visibility !== 'hidden' &&
         window.getComputedStyle(element).display !== 'none';
}

// Click a button based on its index
function clickButton(buttonIndex) {
  const buttonElements = document.querySelectorAll('button, input[type="submit"], input[type="button"], .btn, [role="button"]');
  const button = buttonElements[buttonIndex];
  
  if (button) {
    button.click();
    return true;
  }
  return false;
}

// Find the label element associated with an input
function findLabel(input) {
  // First check for label with 'for' attribute
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) return label;
  }
  
  // Check if input is inside a label
  let parent = input.parentElement;
  while (parent) {
    if (parent.tagName && parent.tagName.toLowerCase() === 'label') {
      return parent;
    }
    parent = parent.parentElement;
  }
  
  return null;
}

// Apply the values from the popup to the actual form fields
function applyFormValues(formValues) {
  const forms = document.querySelectorAll('form');
  
  formValues.forEach(formValue => {
    const formIndex = formValue.formIndex;
    const form = forms[formIndex];
    
    formValue.fields.forEach(field => {
      let input;
      
      if (form) {
        // If we have a form, use it to get the inputs
        const inputs = form.querySelectorAll('input, select, textarea');
        input = inputs[field.index];
      } else {
        // Otherwise, get all inputs on the page
        const inputs = document.querySelectorAll('input, select, textarea');
        input = inputs[field.index];
      }
      
      if (input) {
        if (input.type === 'checkbox' || input.type === 'radio') {
          input.checked = field.value;
          
          // Dispatch change event for checkboxes and radios
          const event = new Event('change', { bubbles: true });
          input.dispatchEvent(event);
        } else {
          input.value = field.value;
          
          // Dispatch input and change events to trigger any listeners
          const inputEvent = new Event('input', { bubbles: true });
          input.dispatchEvent(inputEvent);
          
          const changeEvent = new Event('change', { bubbles: true });
          input.dispatchEvent(changeEvent);
        }
      }
    });
  });
}