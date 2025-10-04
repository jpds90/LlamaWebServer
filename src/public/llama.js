let customRegexRules = []
let customPrefix = ""
let rendering = false
let chatHistory = []
let lastContent = ""
let lastPrompt = ""
let lastHidePrompt = false
let fetchController = null
let isFocusEventHandled = false
let replies = []
let selectedReply = 0

const createComponent = (tag, className = "", innerHTML = "", innerText) => {
  const element = document.createElement(tag)
  element.className = className
  element.innerHTML = innerHTML
  if (innerText) {
    element.innerText = innerText
  }
  return element
}

const appendMessage = (className, innerHTML) => {
  const content = document.querySelector(".content")
  const message = createComponent("span", className, innerHTML)
  content.appendChild(message)
  return message
}

const ask = async (prompt, hidePrompt) => {
  const content = document.querySelector(".content")
  const inputTextbox = document.querySelector(".input_textbox")

  prompt = prompt.trim()
  customPrefix = customPrefix.trim()
  customPrefix = customPrefix ? customPrefix + " " : ""

  if (isMobileDevice()) {
    inputTextbox.blur()
  }

  rendering = true

  lastContent = content.innerHTML
  lastPrompt = prompt
  lastHidePrompt = hidePrompt
  chatHistory.push({ type: "user", text: customPrefix + prompt })

  if (!hidePrompt) {
    const promptContainer = createComponent("div", "prompt_container")
    const promptBackground = createComponent("span", "prompt_background")
    const promptContent = createComponent("div", "prompt_content", "", prompt)

    promptBackground.appendChild(promptContent)
    promptContainer.appendChild(promptBackground)
    content.appendChild(promptContainer)
  }

  let promptResult = null

  if (!hidePrompt) {
    document.querySelector(".actions_container")?.remove()

    promptResult = appendMessage("reply", '<div class="pointer"></div>')
  } else {
    promptResult =
      document.getElementsByClassName("reply")[
        document.getElementsByClassName("reply").length - 1
      ]
    if (promptResult.innerHTML !== '<div class="pointer"></div>') {
      promptResult.innerHTML = '<div class="pointer"></div>'
    }
  }

  document.title = t("title") + " - " + t("thinking")

  scrollToBottom()

  let reply = ""

  try {
    fetchController = new AbortController()

    const responseAPI = await fetch(window.location.origin + "/ask", {
      method: "POST",
      body: JSON.stringify(chatHistory),
      signal: fetchController.signal,
    })

    document.title = t("title") + " - " + t("writing")

    if (responseAPI.ok) {
      const reader = responseAPI.body.getReader()
      const decoder = new TextDecoder()

      const readStream = new Promise((resolve) => {
        const read = () => {
          try {
            reader
              .read()
              .then(({ done, value }) => {
                if (done) {
                  resolve()
                  return
                }
                const newText = decoder.decode(value)
                reply = reply + newText

                const resultText = reply
                  .replace(/\</g, "&#60;")
                  .trim()
                  .replace(/^\),/, "")
                  .trim()
                promptResult.innerHTML =
                  markdownToHTML(resultText) + '<div class="pointer"></div>'
                scrollToBottom()

                read()
              })
              .catch((err) => {
                reply = ""
                resolve()
              })
          } catch (err) {
            reply = ""
            resolve()
          }
        }
        read()
      })

      await readStream
    }
  } catch (err) {
    console.log(err)
    reply = ""
  }

  handleReply(content, reply, promptResult, prompt)
}

const handleReply = (content, reply, promptResult, prompt) => {
  const inputTextbox = document.querySelector(".input_textbox")

  if (reply === "") {
    setTimeout(() => {
      // REMOVING THE LAST USER PROMPT AND RE-ASKING
      chatHistory.pop()
      ask(prompt, true)
    }, 500)
    return
  }

  chatHistory.push({ type: "model", response: [reply] })
  replies.push(reply)
  selectedReply = replies.length
  document.title = t("title")

  document.querySelector(".actions_container")?.remove()

  const buttonsContainer = createComponent("div", "actions_container")

  const buttonNext = createComponent("button", "action_button")
  buttonNext.type = "button"
  buttonNext.innerHTML = selectedReply + "/" + replies.length
  buttonNext.onclick = () => {
    if (rendering) {
      return
    }

    chatHistory.pop()
    chatHistory.pop()
    chatHistory.push({ type: "user", text: prompt })

    if (!replies[selectedReply + 1]) {
      selectedReply = 0
    } else {
      selectedReply = selectedReply + 1
    }

    buttonNext.innerHTML = selectedReply + 1 + "/" + replies.length

    const newReply = replies[selectedReply]

    chatHistory.push({ type: "model", response: [newReply] })

    const resultText = newReply
      .replace(/\</g, "&#60;")
      .trim()
      .replace(/^\),/, "")
      .trim()
    promptResult.innerHTML = markdownToHTML(resultText)
    scrollToBottom()

    const selection = window.getSelection()
    selection.removeAllRanges()
  }

  if (replies.length === 1) {
    buttonNext.style.display = "none"
  }

  buttonsContainer.appendChild(buttonNext)

  const buttonRegenerate = createComponent("button", "action_button")
  buttonRegenerate.type = "button"
  buttonRegenerate.innerHTML =
    '<svg class="regenerate" width="24" height="24" viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.76 0 3.39.77 4.54 2.05L14 10h6V4l-2.35 2.35z"/></svg>'
  buttonRegenerate.onclick = () => {
    if (rendering) {
      return
    }
    const iconRegenerateTemp = document.querySelector(".regenerate")
    if (iconRegenerateTemp.classList.contains("active")) {
      iconRegenerateTemp.classList.remove("active")
    }

    const buttonNextTemp = document.getElementsByClassName("action_button")[0]
    buttonNextTemp.style.display = "block"
    buttonNextTemp.disabled = true
    buttonNextTemp.innerHTML = replies.length + 1 + "/" + (replies.length + 1)
    if (buttonNextTemp.classList.contains("active")) {
      buttonNextTemp.classList.remove("active")
    }

    buttonRegenerate.classList.remove("active")
    buttonRegenerate.disabled = true

    chatHistory.pop()
    chatHistory.pop()
    ask(prompt, true)

    if (!isMobileDevice()) {
      inputTextbox.focus()
    }
  }

  buttonRegenerate.classList.add("active")
  buttonRegenerate.disabled = false
  buttonNext.classList.add("active")
  buttonNext.disabled = false

  buttonsContainer.appendChild(buttonRegenerate)

  content.appendChild(buttonsContainer)

  scrollToBottom()

  document.querySelector(".pointer")?.remove()

  const iconRegenerate = document.querySelector(".regenerate")
  if (!iconRegenerate.classList.contains("active")) {
    iconRegenerate.classList.add("active")
  }

  setTimeout(() => {
    rendering = false
    if (!isMobileDevice()) {
      inputTextbox.focus()
    }
  }, 250)
}

const scrollToBottom = () => {
  const totalHeight = document.documentElement.scrollHeight
  const viewportHeight = window.innerHeight
  const scrollYPosition = window.scrollY
  const pixelsLeft = totalHeight - (scrollYPosition + viewportHeight)
  const finalDistance = Math.max(0, pixelsLeft)

  if (finalDistance > 0) {
    window.scrollTo({
      top: document.body.scrollHeight,
    })
  }
}

const markdownToHTML = (markdown) => {
  const codeBlocks = []

  // STORING AND REMOVING ALL THE CODE BLOCKS
  markdown = markdown.replace(/\`\`\`.*?\n([\s\S]*?)\`\`\`/g, (match, group) => {
    codeBlocks.push(group)
    return "%%CODELLAMABLOCK" + (codeBlocks.length - 1) + "%%"
  })

  // SETTING THE MARKDOWN RULES
  let rules = [
    { regex: /\*\*(.*?)\*\*/g, replacement: "<strong>$1</strong>" },
    { regex: /\*(.*?)\*/g, replacement: "<em>$1</em>" },
    { regex: /__(.*?)__/g, replacement: "<strong>$1</strong>" },
    { regex: /_(.*?)_/g, replacement: "<em>$1</em>" },
    { regex: /\[(.*?)\]\((.*?)\)/g, replacement: '<a href="$2">$1</a>' },
    { regex: /`(.*?)`/g, replacement: '<div class="highlighted">$1</div>' },
    {
      regex: /^(#{1,6})\s*(.*)$/gm,
      replacement: (match, hashes, content) =>
        "<h" + hashes.length + ">" + content + "</h" + hashes.length + ">",
    },
    { regex: /^[\*\-\+] (.+)$/gm, replacement: (match, item) => "&#8226; " + item },
  ]

  rules = rules.concat(customRegexRules)

  // APPLYING THE MARKDOWN RULES
  rules.forEach(({ regex, replacement }) => {
    markdown = markdown.replace(regex, replacement)
  })

  // RESTORING ALL THE CODE BLOCKS
  markdown = markdown.replace(/%%CODELLAMABLOCK(\d+)%%/g, (match, index) => {
    return "<code>" + codeBlocks[index].replace(/```/g, "") + "</code>"
  })

  return markdown
}

const isMobileDevice = () => {
  return !!(
    window.navigator.userAgent.match(/Android/i) ||
    window.navigator.userAgent.match(/webOS/i) ||
    window.navigator.userAgent.match(/iPhone/i) ||
    window.navigator.userAgent.match(/iPad/i) ||
    window.navigator.userAgent.match(/iPod/i) ||
    window.navigator.userAgent.match(/BlackBerry/i) ||
    window.navigator.userAgent.match(/Windows Phone/i)
  )
}

const isUsingiOS = () => {
  return !!(
    window.navigator.userAgent.match(/iPhone/i) ||
    window.navigator.userAgent.match(/iPad/i) ||
    window.navigator.userAgent.match(/iPod/i)
  )
}

const getLineHeight = (element) => {
  const fontSize = parseFloat(window.getComputedStyle(element).fontSize)

  const multipliers = {
    desktop: 1.09,
    android: 1.14,
    ios: 1.17,
  }

  if (isMobileDevice()) {
    if (isUsingiOS()) {
      return fontSize * multipliers.ios
    }
    return fontSize * multipliers.android
  }

  return fontSize * multipliers.desktop
}

const resizeInputText = () => {
  try {
    const inputTextbox = document.querySelector(".input_textbox")

    inputTextbox.rows = 1
    inputTextbox.style.height = "auto"

    const lineHeight = getLineHeight(inputTextbox)
    const scrollHeight = inputTextbox.scrollHeight

    const correction = inputTextbox.offsetHeight - inputTextbox.clientHeight

    let newHeight = scrollHeight - correction
    const maxHeight = lineHeight * 5

    if (newHeight > maxHeight) {
      newHeight = maxHeight
    }

    inputTextbox.style.height = newHeight + "px"
  } catch (err) {
    //
  }

  scrollToBottom()
}

const sendPrompt = (prompt) => {
  prompt = prompt.trim()
  if (prompt) {
    replies.splice(0, replies.length)
    ask(prompt)
  }
}

window.addEventListener("focus", () => {
  if (isUsingiOS() && rendering && !isFocusEventHandled) {
    // WORKAROUND FOR IOS. IOS KILLS ALL THE NETWORK REQUESTS IN PROGRESS
    // AFTER 5 SECONDS WHEN MOVING SAFARI TO THE BACKGROUND. THANK YOU IOS.
    if (fetchController) {
      fetchController.abort()
    }
    isFocusEventHandled = true
  }
})

window.addEventListener("blur", () => {
  // WORKAROUND FOR IOS. IOS KILLS ALL THE NETWORK REQUESTS IN PROGRESS
  // AFTER 5 SECONDS WHEN MOVING SAFARI TO THE BACKGROUND. THANK YOU IOS.
  if (isUsingiOS() && rendering) {
    isFocusEventHandled = false

    if (fetchController) {
      fetchController.abort()
    }

    setTimeout(() => {
      // CLEARING ANY INCOMPLETE RESPONSE (IF ANY)
      if (document.querySelector(".pointer")) {
        const replyCounter = document.getElementsByClassName("reply").length - 1
        const lastReply = document.getElementsByClassName("reply")[replyCounter]
        lastReply.innerHTML = '<div class="pointer"></div>'
      }
    }, 200)
  }
})

window.addEventListener("load", async () => {
  if (window.top === window.self) {
    const content = document.querySelector(".content")
    const headerName = document.querySelector(".header_name")
    const inputContainer = document.querySelector(".input_container")
    const inputTextbox = document.querySelector(".input_textbox")
    const inputSend = document.querySelector(".input_send")

    headerName.innerText = t("title")
    content.innerHTML = ""

    inputTextbox.placeholder = t("placeholder")
    inputTextbox.disabled = false
    inputTextbox.value = ""
    inputTextbox.addEventListener("input", resizeInputText)
    inputTextbox.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault()
      }
    })
    inputTextbox.addEventListener("keyup", (event) => {
      if (event.key === "Enter") {
        event.preventDefault()
        if (!rendering) {
          sendPrompt(inputTextbox.value)
          inputTextbox.value = ""
          resizeInputText()
          if (inputSend.classList.contains("active")) {
            inputSend.classList.remove("active")
          }
        }
      }
    })
    inputTextbox.addEventListener("input", () => {
      if (inputTextbox.value.length > 0) {
        if (!inputSend.classList.contains("contains")) {
          inputSend.classList.add("active")
        }
      } else {
        inputSend.classList.remove("active")
      }
    })

    inputSend.addEventListener("click", () => {
      if (!rendering) {
        sendPrompt(inputTextbox.value)
        inputTextbox.value = ""
        resizeInputText()
        if (inputSend.classList.contains("active")) {
          inputSend.classList.remove("active")
        }
      }
    })

    inputContainer.addEventListener("click", () => {
      inputTextbox.focus()
    })
    inputContainer.style.display = "flex"

    const currentURL = new URL(window.location.href).searchParams
    const requiredLightMode = currentURL.has("lightmode")
    const requiredDarkMode = currentURL.has("darkmode")

    const styleNode = document.createElement("style")
    if (requiredLightMode) {
      styleNode.appendChild(document.createTextNode(STYLES_LIGHT_MODE))
    } else if (requiredDarkMode) {
      styleNode.appendChild(document.createTextNode(STYLES_DARK_MODE))
    } else {
      styleNode.appendChild(document.createTextNode(STYLES_ALL))
    }
    document.head.appendChild(styleNode)

    chatHistory.push({ type: "system", text: t("system_prompt") })

    appendMessage("reply", t("system_welcome"))

    document.body.style.display = "block"

    resizeInputText()

    if (!isMobileDevice()) {
      setTimeout(() => {
        inputTextbox.focus()
      }, 200)
    }
  }
})
