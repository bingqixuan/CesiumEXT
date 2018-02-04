varying float TransparentOut;
varying vec4 ColorOut;
void main(void)
{
    gl_FragColor = vec4(ColorOut.x,ColorOut.y,ColorOut.z,ColorOut.w*TransparentOut);
}
