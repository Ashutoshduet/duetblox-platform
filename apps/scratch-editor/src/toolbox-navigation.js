// Keep this small adapter isolated from the host. The pinned standalone GUI
// exposes its current toolbox XML through EditorState, but no category-select
// API. Activate the same public category element that handles a student's
// pointer press; never reach into React or Blockly's private workspace objects.
export function createToolboxNavigation({mount, vm, activateCode, getToolboxXML}) {
  const target = () => ({targetName: vm.editingTarget?.getName() || '', isStage: Boolean(vm.editingTarget?.isStage)});
  function getCategories() {
    const document = new DOMParser().parseFromString(getToolboxXML() || '<xml/>', 'text/xml');
    if (document.querySelector('parsererror')) throw new Error('The block menu could not be read. Reopen the Code tab.');
    const categories = [...document.querySelectorAll('category')].map(category => ({
      id: category.getAttribute('toolboxitemid') || category.getAttribute('id'),
      name: category.getAttribute('name') || '',
      // Variables and My Blocks use upstream dynamic flyouts. Do not report
      // a zero block count as if their blocks were unavailable.
      dynamic: Boolean(category.getAttribute('custom')),
      blockCount: category.getAttribute('custom') ? null : [...category.children].filter(child => child.tagName === 'block').length
    })).filter(category => category.id);
    return {categories, ...target()};
  }
  async function selectCategory(categoryId, {waitForRegistration = false} = {}) {
    if (typeof categoryId !== 'string' || (!waitForRegistration && !getCategories().categories.some(category => category.id === categoryId))) {
      throw new Error('Choose a category from the available block menu.');
    }
    activateCode();
    // Switching from Costumes/Sounds mounts the real Blockly workspace on the
    // next React update. Extension loading can also queue a toolbox refresh.
    const deadline = performance.now() + 3000;
    while (performance.now() < deadline) {
      const category = [...mount.querySelectorAll('.blocklyToolboxCategory')].find(element => element.id === categoryId);
      if (category && category.getBoundingClientRect().height > 0) {
        category.scrollIntoView({block: 'nearest', inline: 'nearest'});
        category.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, pointerType: 'mouse', button: 0}));
        const container = category.closest('[role="treeitem"]');
        container?.focus({preventScroll: true});
        if (category.classList.contains('blocklyToolboxSelected')) {
          return {categoryId, name: category.textContent.trim(), ...target()};
        }
      }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('The block menu is still opening. Try the category again.');
  }
  return {getCategories, selectCategory};
}
