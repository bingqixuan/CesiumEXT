attribute vec4 Position;
attribute vec2 HLevel;

uniform int u_ProjectionType;
uniform float u_CameraDistance;
uniform vec4 u_LineColor;

varying float TransparentOut;
varying vec4 ColorOut;

int iMod(int x, int y)
{
    return x - y * int(floor(float(x)/float(y)));
}

void main(void)
{
    float xLevel = HLevel.x;
    TransparentOut = 1.0;
    ColorOut = u_LineColor;
    gl_Position = czm_modelViewProjection * vec4(0.0,0.0,0.0,1.0);
    if(xLevel == 0.0)
    {
        ColorOut = vec4(1.0,0.0,0.0,1.0);
    }
    if(u_CameraDistance > 3200000.0 && (mod(xLevel, 8.0) > 0.0))
    {
        TransparentOut = 0.0;
        return;
    }
    else if(u_CameraDistance > 2000000.0 && (mod(xLevel, 4.0) > 0.0))
    {
        TransparentOut = 0.0;
        return;
    }
    else if(u_CameraDistance > 1000000.0 && (mod(xLevel, 2.0) > 0.0))
    {
        TransparentOut = 0.0;
        return;
    }
    vec2 GeoPos = vec2(Position.x, Position.y);
    vec3 WorldPosition = CoorConvert(u_ProjectionType, GeoPos, 10.0);
    gl_Position = czm_modelViewProjection * vec4(WorldPosition, 1.0);
}
