"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.methods = void 0;
exports.load = load;
exports.unload = unload;
// @ts-ignore
const package_json_1 = __importDefault(require("../package.json"));
/**
 * @en Registration method for the main process of Extension
 * @zh 为扩展的主进程的注册方法
 */
exports.methods = {
    /**
     * @en A method that can be triggered by message
     * @zh 通过 message 触发的方法
     */
    openPanel() {
        Editor.Panel.open(package_json_1.default.name);
    },
    openI18nPanel() {
        Editor.Panel.open(`${package_json_1.default.name}.i18n`);
    },
    openGuidePanel() {
        Editor.Panel.open(`${package_json_1.default.name}.guide`);
    },
    onI18nPanelStateChanged(...args) {
        // console.log(`[${packageJSON.name}] i18n panel state changed`, ...args);
    }
};
/**
 * @en Method Triggered on Extension Startup
 * @zh 扩展启动时触发的方法
 */
function load() { }
/**
 * @en Method triggered when uninstalling the extension
 * @zh 卸载扩展时触发的方法
 */
function unload() { }
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NvdXJjZS9tYWluLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQTZCQSxvQkFBMEI7QUFNMUIsd0JBQTRCO0FBbkM1QixhQUFhO0FBQ2IsbUVBQTBDO0FBQzFDOzs7R0FHRztBQUNVLFFBQUEsT0FBTyxHQUE0QztJQUM5RDs7O09BR0c7SUFDSCxTQUFTO1FBQ1AsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsc0JBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN0QyxDQUFDO0lBQ0QsYUFBYTtRQUNYLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsc0JBQVcsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxDQUFDO0lBQ2hELENBQUM7SUFDRCxjQUFjO1FBQ1osTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxzQkFBVyxDQUFDLElBQUksUUFBUSxDQUFDLENBQUM7SUFDakQsQ0FBQztJQUNELHVCQUF1QixDQUFDLEdBQUcsSUFBVztRQUNwQywwRUFBMEU7SUFDNUUsQ0FBQztDQUNGLENBQUM7QUFFRjs7O0dBR0c7QUFDSCxTQUFnQixJQUFJLEtBQUssQ0FBQztBQUUxQjs7O0dBR0c7QUFDSCxTQUFnQixNQUFNLEtBQUssQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8vIEB0cy1pZ25vcmVcclxuaW1wb3J0IHBhY2thZ2VKU09OIGZyb20gJy4uL3BhY2thZ2UuanNvbic7XHJcbi8qKlxyXG4gKiBAZW4gUmVnaXN0cmF0aW9uIG1ldGhvZCBmb3IgdGhlIG1haW4gcHJvY2VzcyBvZiBFeHRlbnNpb25cclxuICogQHpoIOS4uuaJqeWxleeahOS4u+i/m+eoi+eahOazqOWGjOaWueazlVxyXG4gKi9cclxuZXhwb3J0IGNvbnN0IG1ldGhvZHM6IHsgW2tleTogc3RyaW5nXTogKC4uLmFueTogYW55KSA9PiBhbnkgfSA9IHtcclxuICAvKipcclxuICAgKiBAZW4gQSBtZXRob2QgdGhhdCBjYW4gYmUgdHJpZ2dlcmVkIGJ5IG1lc3NhZ2VcclxuICAgKiBAemgg6YCa6L+HIG1lc3NhZ2Ug6Kem5Y+R55qE5pa55rOVXHJcbiAgICovXHJcbiAgb3BlblBhbmVsKCkge1xyXG4gICAgRWRpdG9yLlBhbmVsLm9wZW4ocGFja2FnZUpTT04ubmFtZSk7XHJcbiAgfSxcclxuICBvcGVuSTE4blBhbmVsKCkge1xyXG4gICAgRWRpdG9yLlBhbmVsLm9wZW4oYCR7cGFja2FnZUpTT04ubmFtZX0uaTE4bmApO1xyXG4gIH0sXHJcbiAgb3Blbkd1aWRlUGFuZWwoKSB7XHJcbiAgICBFZGl0b3IuUGFuZWwub3BlbihgJHtwYWNrYWdlSlNPTi5uYW1lfS5ndWlkZWApO1xyXG4gIH0sXHJcbiAgb25JMThuUGFuZWxTdGF0ZUNoYW5nZWQoLi4uYXJnczogYW55W10pIHtcclxuICAgIC8vIGNvbnNvbGUubG9nKGBbJHtwYWNrYWdlSlNPTi5uYW1lfV0gaTE4biBwYW5lbCBzdGF0ZSBjaGFuZ2VkYCwgLi4uYXJncyk7XHJcbiAgfVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIEBlbiBNZXRob2QgVHJpZ2dlcmVkIG9uIEV4dGVuc2lvbiBTdGFydHVwXHJcbiAqIEB6aCDmianlsZXlkK/liqjml7bop6blj5HnmoTmlrnms5VcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBsb2FkKCkgeyB9XHJcblxyXG4vKipcclxuICogQGVuIE1ldGhvZCB0cmlnZ2VyZWQgd2hlbiB1bmluc3RhbGxpbmcgdGhlIGV4dGVuc2lvblxyXG4gKiBAemgg5Y246L295omp5bGV5pe26Kem5Y+R55qE5pa55rOVXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gdW5sb2FkKCkgeyB9XHJcbiJdfQ==