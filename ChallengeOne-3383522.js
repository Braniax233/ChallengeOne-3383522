class TrieNode {
    constructor() {
      this.children = {};
      this.end = false;
    }
  }
  
  class Trie {
    constructor() {
      this.root = new TrieNode();
    }
  
    insert(word) {
      let node = this.root;
      for (let ch of word) {
        if (!node.children[ch]) {
          node.children[ch] = new TrieNode();
        }
        node = node.children[ch];
      }
      node.end = true;
    }
  
    search(word) {
      let node = this.root;
      for (let ch of word) {
        if (!node.children[ch]) return false;
        node = node.children[ch];
      }
      return node.end;
    }
  
    startsWith(prefix) {
      let node = this.root;
      for (let ch of prefix) {
        if (!node.children[ch]) return false;
        node = node.children[ch];
      }
      return true;
    }
  }
  