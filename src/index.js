// Custom types:
/**
 * @typedef {Object.<string, any>} VNode
 * @property {string | Function} name
 * @property {Props} props
 * @property {Children} children
 * @property {Element} element
 * @property {string | number | null} key
 * @property {number} type
 */
/**
 * @typedef {Object.<string, any> | {}} Props
 */
/**
 * @typedef {VNode[]} Children
 */

var DEFAULT = 0
var RECYCLED_NODE = 1
var TEXT_NODE = 2

var XLINK_NS = "http://www.w3.org/1999/xlink"
var SVG_NS = "http://www.w3.org/2000/svg"

var EMPTY_OBJECT = {}
var EMPTY_ARRAY = []

var map = EMPTY_ARRAY.map
var isArray = Array.isArray

/**
 * Function to merge two objects. The properties of the second will be added to the first.
 * @param {Object.<string, any>} a
 * @param {Object.<string, any>} b
 * @return {Object.<string, any>} target
 */
var merge = function (a, b) {
  var target = {}

  for (var i in a) target[i] = a[i]
  for (var i in b) target[i] = b[i]

  return target
}

/**
 * Event proxy for inline events.
 * @param {Event} event 
 * @return {any} any
 */
var eventProxy = function (event) {
  return event.currentTarget['events'][event.type](event)
}

/**
 * Update the properties and attributes of a VNode based on new data.
 * @param {Element} element 
 * @param {string} name 
 * @param {any} lastValue 
 * @param {any} nextValue 
 * @param {boolean} isSvg 
 * @return {void} undefined
 */
var updateProperty = function (element, name, lastValue, nextValue, isSvg) {
  if (name === "key") {
  } else if (name === "style") {
    for (var i in merge(lastValue, nextValue)) {
      var style = nextValue == null || nextValue[i] == null ? "" : nextValue[i]
      if (i[0] === "-") {
        element[name].setProperty(i, style)
      } else {
        element[name][i] = style
      }
    }
  } else {
    if (name[0] === "o" && name[1] === "n") {
      if (!element['events']) element['events'] = {}

      element['events'][(name = name.slice(2))] = nextValue

      if (nextValue == null) {
        element.removeEventListener(name, eventProxy)
      } else if (lastValue == null) {
        element.addEventListener(name, eventProxy)
      }
    } else {
      var nullOrFalse = nextValue == null || nextValue === false

      if (
        name in element &&
        name !== "list" &&
        name !== "draggable" &&
        name !== "spellcheck" &&
        name !== "translate" &&
        !isSvg
      ) {
        element[name] = nextValue == null ? "" : nextValue
        if (nullOrFalse) {
          element.removeAttribute(name)
        }
      } else {
        var ns = isSvg && name !== (name = name.replace(/^xlink:?/, ""))
        if (ns) {
          if (nullOrFalse) {
            element.removeAttributeNS(XLINK_NS, name)
          } else {
            element.setAttributeNS(XLINK_NS, name, nextValue)
          }
        } else {
          if (nullOrFalse) {
            element.removeAttribute(name)
          } else {
            element.setAttribute(name, nextValue)
          }
        }
      }
    }
  }
}

/**
 * Create an element, either node or text, from a VNode.
 * @param {VNode} node 
 * @param {any[]} lifecycle 
 * @param {boolean} isSvg 
 * @return {Element}
 */
var createElement = function (node, lifecycle, isSvg) {
  var element =
    node.type === TEXT_NODE
      ? document.createTextNode(/** @type{ string } */(node.name))
      : (isSvg = isSvg || node.name === "svg")
        ? document.createElementNS(SVG_NS, /** @type{ string } */(node.name))
        : document.createElement(/** @type{ string } */(node.name))

  var props = node.props
  if (props['oncreate']) {
    lifecycle.push(function () {
      props['oncreate'](element)
    })
  }

  for (var i = 0, length = node.children.length; i < length; i++) {
    element.appendChild(createElement(node.children[i], lifecycle, isSvg))
  }

  for (var name in props) {
    updateProperty(/** @type { Element } */(element), name, null, props[name], isSvg)
  }

  return (node.element = /** @type {Element} */(element))
}

/**
 * 
 * @param {Element} element 
 * @param {Props} lastProps 
 * @param {Props} nextProps
 * @param {any[]} lifecycle 
 * @param {boolean} isSvg 
 * @param {boolean} isRecycled 
 * @return {void} undefined
 */
var updateElement = function (
  element,
  lastProps,
  nextProps,
  lifecycle,
  isSvg,
  isRecycled
) {
  for (var name in merge(lastProps, nextProps)) {
    if (
      (name === "value" || name === "checked"
        ? element[name]
        : lastProps[name]) !== nextProps[name]
    ) {
      updateProperty(element, name, lastProps[name], nextProps[name], isSvg)
    }
  }

  var cb = isRecycled ? nextProps['oncreate'] : nextProps['onupdate']
  if (cb != null) {
    lifecycle.push(function () {
      cb(element, lastProps)
    })
  }
}

/**
 * 
 * @param {VNode} node 
 * @return {Element}
 */
var removeChildren = function (node) {
  for (var i = 0, length = node.children.length; i < length; i++) {
    removeChildren(node.children[i])
  }

  var cb = node.props['ondestroy']
  if (cb != null) {
    cb(node.element)
  }

  return node.element
}

/**
 * 
 * @param {Element} parent 
 * @param {VNode} node 
 * @return {void} undefined
 */
var removeElement = function (parent, node) {
  var remove = function () {
    parent.removeChild(removeChildren(node))
  }

  var cb = node.props && node.props['onremove']
  if (cb != null) {
    cb(node.element, remove)
  } else {
    remove()
  }
}

/**
 * 
 * @param {VNode} node
 * @return {string | number | null} 
 */
var getKey = function (node) {
  return node == null ? null : node.key
}

/**
 * 
 * @param {VNode[]} children 
 * @param {number} start 
 * @param {number} end 
 * @return {Object.<string, any>} Object.<string, any>
 */
var createKeyMap = function (children, start, end) {
  var out = {}
  var key
  var node

  for (; start <= end; start++) {
    if ((key = (node = children[start]).key) != null) {
      out[key] = node
    }
  }

  return out
}

/**
 * 
 * @param {Element} parent 
 * @param {Element} element 
 * @param {VNode} lastNode 
 * @param {VNode} nextNode
 * @param {any[]} lifecycle 
 * @param {boolean} [isSvg] 
 * @return {VNode}
 */
var patchElement = function (
  parent,
  element,
  lastNode,
  nextNode,
  lifecycle,
  isSvg
) {
  if (nextNode === lastNode) {
  } else if (
    lastNode != null &&
    lastNode.type === TEXT_NODE &&
    nextNode.type === TEXT_NODE
  ) {
    if (lastNode.name !== nextNode.name) {
      element.nodeValue = /** @type {string} */(nextNode.name)
    }
  } else if (lastNode == null || lastNode.name !== nextNode.name) {
    var newElement = parent.insertBefore(
      createElement(nextNode, lifecycle, isSvg),
      element
    )

    if (lastNode != null) removeElement(parent, lastNode)

    element = newElement
  } else {
    updateElement(
      element,
      lastNode.props,
      nextNode.props,
      lifecycle,
      (isSvg = isSvg || nextNode.name === "svg"),
      lastNode.type === RECYCLED_NODE
    )

    var savedNode
    var childNode

    var lastKey
    var lastChildren = lastNode.children
    var lastChStart = 0
    var lastChEnd = lastChildren.length - 1

    var nextKey
    var nextChildren = nextNode.children
    var nextChStart = 0
    var nextChEnd = nextChildren.length - 1

    while (nextChStart <= nextChEnd && lastChStart <= lastChEnd) {
      lastKey = getKey(lastChildren[lastChStart])
      nextKey = getKey(nextChildren[nextChStart])

      if (lastKey == null || lastKey !== nextKey) break

      patchElement(
        element,
        lastChildren[lastChStart].element,
        lastChildren[lastChStart],
        nextChildren[nextChStart],
        lifecycle,
        isSvg
      )

      lastChStart++
      nextChStart++
    }

    while (nextChStart <= nextChEnd && lastChStart <= lastChEnd) {
      lastKey = getKey(lastChildren[lastChEnd])
      nextKey = getKey(nextChildren[nextChEnd])

      if (lastKey == null || lastKey !== nextKey) break

      patchElement(
        element,
        lastChildren[lastChEnd].element,
        lastChildren[lastChEnd],
        nextChildren[nextChEnd],
        lifecycle,
        isSvg
      )

      lastChEnd--
      nextChEnd--
    }

    if (lastChStart > lastChEnd) {
      while (nextChStart <= nextChEnd) {
        element.insertBefore(
          createElement(nextChildren[nextChStart++], lifecycle, isSvg),
          (childNode = lastChildren[lastChStart]) && childNode.element
        )
      }
    } else if (nextChStart > nextChEnd) {
      while (lastChStart <= lastChEnd) {
        removeElement(element, lastChildren[lastChStart++])
      }
    } else {
      var lastKeyed = createKeyMap(lastChildren, lastChStart, lastChEnd)
      var nextKeyed = {}

      while (nextChStart <= nextChEnd) {
        lastKey = getKey((childNode = lastChildren[lastChStart]))
        nextKey = getKey(nextChildren[nextChStart])

        if (
          nextKeyed[lastKey] ||
          (nextKey != null && nextKey === getKey(lastChildren[lastChStart + 1]))
        ) {
          if (lastKey == null) {
            removeElement(element, childNode)
          }
          lastChStart++
          continue
        }

        if (nextKey == null || lastNode.type === RECYCLED_NODE) {
          if (lastKey == null) {
            patchElement(
              element,
              childNode && childNode.element,
              childNode,
              nextChildren[nextChStart],
              lifecycle,
              isSvg
            )
            nextChStart++
          }
          lastChStart++
        } else {
          if (lastKey === nextKey) {
            patchElement(
              element,
              childNode.element,
              childNode,
              nextChildren[nextChStart],
              lifecycle,
              isSvg
            )
            nextKeyed[nextKey] = true
            lastChStart++
          } else {
            if ((savedNode = lastKeyed[nextKey]) != null) {
              patchElement(
                element,
                element.insertBefore(
                  savedNode.element,
                  childNode && childNode.element
                ),
                savedNode,
                nextChildren[nextChStart],
                lifecycle,
                isSvg
              )
              nextKeyed[nextKey] = true
            } else {
              patchElement(
                element,
                childNode && childNode.element,
                null,
                nextChildren[nextChStart],
                lifecycle,
                isSvg
              )
            }
          }
          nextChStart++
        }
      }

      while (lastChStart <= lastChEnd) {
        if (getKey((childNode = lastChildren[lastChStart++])) == null) {
          removeElement(element, childNode)
        }
      }

      for (var key in lastKeyed) {
        if (nextKeyed[key] == null) {
          removeElement(element, lastKeyed[key])
        }
      }
    }
  }

  return (nextNode.element = /** @type {any} */(element))
}
/**
 * @param {string | Function} name 
 * @param {Props} props 
 * @param {Children} children 
 * @param {Element} element 
 * @param {string | number | null} key 
 * @param {number} type 
 * @return {VNode} VNode
 */
var createVNode = function (name, props, children, element, key, type) {
  return {
    name: name,
    props: props,
    children: children,
    element: element,
    key: key,
    type: type
  }
}

/**
 * 
 * @param {string} text 
 * @param {Element} [element] 
 * @return {VNode} VNode
 */
var createTextVNode = function (text, element) {
  return createVNode(text, EMPTY_OBJECT, EMPTY_ARRAY, element, null, TEXT_NODE)
}

/**
 * 
 * @param {Element} element 
 * @return {VNode}
 */
var recycleChild = function (element) {
  return element.nodeType === 3 // Node.TEXT_NODE
    ? createTextVNode(element.nodeValue, element)
    : recycleElement(element)
}

/**
 * 
 * @param {Element} element 
 * @return {VNode} VNode
 */
var recycleElement = function (element) {
  return createVNode(
    element.nodeName.toLowerCase(),
    EMPTY_OBJECT,
    map.call(element.childNodes, recycleChild),
    element,
    null,
    RECYCLED_NODE
  )
}

/**
 * 
 * @param {Element} container 
 * @return {VNode} VNode
 */
export var recycle = function (container) {
  return recycleElement(container.children[0])
}

/**
 * 
 * @param {VNode} lastNode 
 * @param {VNode} nextNode
 * @param {Element} container 
 * @return {VNode} VNode
 */
export var patch = function (lastNode, nextNode, container) {
  var lifecycle = []

  patchElement(container, container.children[0], lastNode, nextNode, lifecycle)

  while (lifecycle.length > 0) lifecycle.pop()()

  return nextNode
}

/**
 * 
 * @param {string | Function} name 
 * @param {Object.<string, any>} props 
 * @return {VNode}
 */
export var h = function (name, props) {
  var node
  var rest = []
  var children = []
  var length = arguments.length

  while (length-- > 2) rest.push(arguments[length])

  if ((props = props == null ? {} : props).children != null) {
    if (rest.length <= 0) {
      rest.push(props.children)
    }
    delete props.children
  }

  while (rest.length > 0) {
    if (isArray((node = rest.pop()))) {
      for (length = node.length; length-- > 0;) {
        rest.push(node[length])
      }
    } else if (node === false || node === true || node == null) {
    } else {
      children.push(typeof node === "object" ? node : createTextVNode(node))
    }
  }

  return typeof name === "function"
    ? name(props, (props.children = children))
    : createVNode(name, props, children, null, props.key, DEFAULT)
}
