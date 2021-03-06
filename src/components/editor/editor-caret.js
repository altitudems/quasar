import Dialog from '../dialog'

function getBlockElement (el, parent) {
  if (parent && el === parent) {
    return null
  }

  const
    style = window.getComputedStyle
      ? window.getComputedStyle(el)
      : el.currentStyle,
    display = style.display

  if (display === 'block' || display === 'table') {
    return el
  }

  return getBlockElement(el.parentNode)
}

function isChildOf (el, parent) {
  if (!el) {
    return false
  }
  while ((el = el.parentNode)) {
    if (el === document.body) {
      return false
    }
    if (el === parent) {
      return true
    }
  }
  return false
}

export class Caret {
  constructor (el) {
    this.el = el
  }

  get selection () {
    if (!this.el) {
      return
    }
    const sel = document.getSelection()
    // only when the selection in element
    if (isChildOf(sel.anchorNode, this.el) && isChildOf(sel.focusNode, this.el)) {
      return sel
    }
  }

  get range () {
    const sel = this.selection

    if (!sel) {
      return
    }

    return sel.rangeCount
      ? sel.getRangeAt(0)
      : null
  }

  get parent () {
    const range = this.range
    if (!range) {
      return
    }

    const node = range.startContainer
    return node.nodeType === document.ELEMENT_NODE
      ? node
      : node.parentNode
  }

  get blockParent () {
    const parent = this.parent
    if (!parent) {
      return
    }
    return getBlockElement(parent, this.el)
  }

  save (range = this.range) {
    this._range = range
  }

  restore (range = this._range) {
    const
      r = document.createRange(),
      sel = document.getSelection()

    if (range) {
      r.setStart(range.startContainer, range.startOffset)
      r.setEnd(range.endContainer, range.endOffset)
      sel.removeAllRanges()
      sel.addRange(r)
    }
    else {
      sel.selectAllChildren(this.el)
      sel.collapseToEnd()
    }
  }

  hasParent (name, spanLevel) {
    const el = spanLevel
      ? this.parent
      : this.blockParent

    return el
      ? el.nodeName.toLowerCase() === name.toLowerCase()
      : false
  }

  hasParents (list) {
    const el = this.parent
    return el
      ? list.includes(el.nodeName.toLowerCase())
      : false
  }

  is (cmd, param) {
    switch (cmd) {
      case 'formatBlock':
        if (param === 'DIV' && this.parent === this.el) {
          return true
        }
        return this.hasParent(param, param === 'PRE')
      case 'link':
        return this.hasParent('A', true)
      case 'fontSize':
        return document.queryCommandValue(cmd) === param
      default:
        const state = document.queryCommandState(cmd)
        return param ? state === param : state
    }
  }

  getParentAttribute (attrib) {
    if (this.parent) {
      return this.parent.getAttribute(attrib)
    }
  }

  can (name) {
    if (name === 'outdent') {
      return this.hasParents(['blockquote', 'li'])
    }
    if (name === 'indent') {
      const parentName = this.parent ? this.parent.nodeName.toLowerCase() : false
      if (parentName === 'blockquote') {
        return false
      }
      if (parentName === 'li') {
        const previousEl = this.parent.previousSibling
        return previousEl && previousEl.nodeName.toLowerCase() === 'li'
      }
      return false
    }
  }

  apply (cmd, param, done = () => {}) {
    if (cmd === 'formatBlock') {
      if (['BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE'].includes(param) && this.is(param)) {
        this.apply('outdent')
        done()
        return
      }
    }
    else if (cmd === 'print') {
      const win = window.open('', '_blank', 'width=600,height=700,left=200,top=100,menubar=no,toolbar=no,location=no,scrollbars=yes')
      win.document.open()
      win.document.write(`<!doctype html><html><head><title>Print</title></head><body onload="print();"><div>${this.el.innerHTML}</div></body></html>`)
      win.document.close()
      done()
      return
    }
    else if (cmd === 'link') {
      const link = this.getParentAttribute('href')
      if (link && this.range) {
        this.range.selectNodeContents(this.parent)
      }
      this.save()
      Dialog.create({
        title: 'Link',
        message: this.selection ? this.selection.toString() : null,
        form: {
          url: {
            type: 'text',
            label: 'URL',
            model: link || 'http://'
          }
        },
        buttons: [
          {
            label: link ? 'Remove' : 'Cancel',
            handler: () => {
              if (link) {
                this.restore()
                document.execCommand('unlink')
                done()
              }
            }
          },
          {
            label: link ? 'Update' : 'Create',
            handler: data => {
              this.restore()
              document.execCommand('createLink', false, data.url)
              done()
            }
          }
        ]
      })
      return
    }
    document.execCommand(cmd, false, param)
    done()
  }
}
