# WebGL工作原理
```
var primitiveType = gl.TRIANGLES;
var offset = 0;
var count = 9;
gl.drawArrays(primitiveType, offset, count);

count: 表示需要处理9个顶点
primitiveType：绘制三角形
每完成三个顶点绘制,就会进行光栅化这个三角形
```
# WebGL着色器和GLSL
```js

顶点着色器需需要数据可以从下面方式设置

1.Attributs 属性
//GPU 缓存
var buf = gl.createBuffer();
/*绑定GPU缓存*/
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
/*讲缓存复制到GPU缓存中*/
gl.bufferData(gl.ARRAY_BUFFER, someData, gl.STATIC_DRAW);

/**找到程序中a_position 的内存位置*/
var positionLoc = gl.getAttribLocation(someShaderProgram, "a_position");
/**开启从缓存读取数据*/
gl.enableVertexAttribArray(positionLoc);


var numComponents = 3;  // (x, y, z)
var type = gl.FLOAT;    // 32位浮点数据
var normalize = false;  // 不标准化
var offset = 0;         // 从缓冲起始位置开始获取
var stride = 0;         // 到下一个数据跳多少位内存
                        // 0 = 使用当前的单位个数和单位长度 （ 3 * Float32Array.BYTES_PER_ELEMENT 

gl.vertexAttribPointer(positionLoc, numComponents, type, false, stride, offset);


2.Uniforms全局变量
/**获取程序中全局变量的位置*/
var offsetLoc = gl.getUniformLocation(someProgram, "u_offset");
/*设置 u_offset 全局变量的值*/
gl.uniform4fv(offsetLoc, [1, 0, 0, 0]);  // 向右偏移一半屏幕宽度


note:
    全局变量有很多类型


gl.uniform1f (floatUniformLoc, v);                 // float
gl.uniform1fv(floatUniformLoc, [v]);               // float 或 float array
gl.uniform2f (vec2UniformLoc,  v0, v1);            // vec2
gl.uniform2fv(vec2UniformLoc,  [v0, v1]);          // vec2 或 vec2 array
gl.uniform3f (vec3UniformLoc,  v0, v1, v2);        // vec3
gl.uniform3fv(vec3UniformLoc,  [v0, v1, v2]);      // vec3 或 vec3 array
gl.uniform4f (vec4UniformLoc,  v0, v1, v2, v4);    // vec4
gl.uniform4fv(vec4UniformLoc,  [v0, v1, v2, v4]);  // vec4 或 vec4 array
 
gl.uniformMatrix2fv(mat2UniformLoc, false, [  4x element array ])  // mat2 或 mat2 array
gl.uniformMatrix3fv(mat3UniformLoc, false, [  9x element array ])  // mat3 或 mat3 array
gl.uniformMatrix4fv(mat4UniformLoc, false, [ 16x element array ])  // mat4 或 mat4 array
 
gl.uniform1i (intUniformLoc,   v);                 // int
gl.uniform1iv(intUniformLoc, [v]);                 // int 或 int array
gl.uniform2i (ivec2UniformLoc, v0, v1);            // ivec2
gl.uniform2iv(ivec2UniformLoc, [v0, v1]);          // ivec2 或 ivec2 array
gl.uniform3i (ivec3UniformLoc, v0, v1, v2);        // ivec3
gl.uniform3iv(ivec3UniformLoc, [v0, v1, v2]);      // ivec3 or ivec3 array
gl.uniform4i (ivec4UniformLoc, v0, v1, v2, v4);    // ivec4
gl.uniform4iv(ivec4UniformLoc, [v0, v1, v2, v4]);  // ivec4 或 ivec4 array
 
gl.uniform1i (sampler2DUniformLoc,   v);           // sampler2D (textures)
gl.uniform1iv(sampler2DUniformLoc, [v]);           // sampler2D 或 sampler2D array
 
gl.uniform1i (samplerCubeUniformLoc,   v);         // samplerCube (textures)
gl.uniform1iv(samplerCubeUniformLoc, [v]);         // samplerCube 或 samplerCube array



例如:
// 着色器里 vec2 数组  有三个元素
uniform vec2 u_someVec2[3];//(1,2) (3,4) (5,6)
 
// JavaScript 初始化时
var someVec2Loc = gl.getUniformLocation(someProgram, "u_someVec2");
 
// 渲染的时候
gl.uniform2fv(someVec2Loc, [1, 2, 3, 4, 5, 6]);  // 设置数组 u_someVec2

单独设置着色器数组里面的某一个元素的值

// JavaScript 初始化时
var someVec2Element0Loc = gl.getUniformLocation(someProgram, "u_someVec2[0]");
var someVec2Element1Loc = gl.getUniformLocation(someProgram, "u_someVec2[1]");
var someVec2Element2Loc = gl.getUniformLocation(someProgram, "u_someVec2[2]");
 
// 渲染的时候
gl.uniform2fv(someVec2Element0Loc, [1, 2]);  // set element 0
gl.uniform2fv(someVec2Element1Loc, [3, 4]);  // set element 1
gl.uniform2fv(someVec2Element2Loc, [5, 6]);  // set element 2


uniform 结构体


struct SomeStruct {
  bool active;
  vec2 someVec2;
};
uniform SomeStruct u_someThing;

var someThingActiveLoc = gl.getUniformLocation(someProgram, "u_someThing.active");
var someThingSomeVec2Loc = gl.getUniformLocation(someProgram, "u_someThing.someVec2");


片元着色器
1.Uniform(和顶点着色器一样)
    Texture 纹理


precision mediump float;
 
uniform sampler2D u_texture;
 
void main() {
   vec2 texcoord = vec2(0.5, 0.5);  // 获取纹理中心的值
   gl_FragColor = texture2D(u_texture, texcoord);
}


var tex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, tex);
var level = 0;
var width = 2;
var height = 1;
var data = new Uint8Array([
   255, 0, 0, 255,   // 一个红色的像素
   0, 255, 0, 255,   // 一个绿色的像素
]);
gl.texImage2D(gl.TEXTURE_2D, level, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);



/**在程序中找到 u_texture 纹理对象的位置**/
var someSamplerLoc = gl.getUniformLocation(someProgram, "u_texture");


/**将纹理绑定到纹理单元上**/
var unit = 5;  // 挑选一个纹理单元
gl.activeTexture(gl.TEXTURE0 + unit);
gl.bindTexture(gl.TEXTURE_2D, tex);

/**告诉someSamplerLoc 纹理对象使用 纹理单元为 unit 的纹理**/
gl.uniform1i(someSamplerLoc, unit);

Varyings的可变量

```
## GLSL
```
v.yyyy
和
vec4(v.y,v.y,v.y,v.y) 是一样的

vec4(v.rgb, 1)
和
vec4(v.r,v.g,v.b, 1) 是一样的


vec4(1)
和
vec4(1,1,1, 1) 是一样的


note: GLSL 是强类型语言
float a=1.0;
float b=float(2);// 讲integer 转换为 float

```