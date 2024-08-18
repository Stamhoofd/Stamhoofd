import { XlsxFileWriter } from "./XlsxFileWriter";

export class XlsxThemeWriter extends XlsxFileWriter {
    async close() {
        await this.write(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme">
    <a:themeElements>
        <a:clrScheme name="Office">
            <a:dk1>
                <a:sysClr val="windowText" lastClr="000000" />
            </a:dk1>
            <a:lt1>
                <a:sysClr val="window" lastClr="FFFFFF" />
            </a:lt1>
            <a:dk2>
                <a:srgbClr val="0E2841" />
            </a:dk2>
            <a:lt2>
                <a:srgbClr val="E8E8E8" />
            </a:lt2>
            <a:accent1>
                <a:srgbClr val="156082" />
            </a:accent1>
            <a:accent2>
                <a:srgbClr val="E97132" />
            </a:accent2>
            <a:accent3>
                <a:srgbClr val="196B24" />
            </a:accent3>
            <a:accent4>
                <a:srgbClr val="0F9ED5" />
            </a:accent4>
            <a:accent5>
                <a:srgbClr val="A02B93" />
            </a:accent5>
            <a:accent6>
                <a:srgbClr val="4EA72E" />
            </a:accent6>
            <a:hlink>
                <a:srgbClr val="467886" />
            </a:hlink>
            <a:folHlink>
                <a:srgbClr val="96607D" />
            </a:folHlink>
        </a:clrScheme>
        <a:fontScheme name="Office">
            <a:majorFont>
                <a:latin typeface="Aptos Display" panose="02110004020202020204" />
                <a:ea typeface="" />
                <a:cs typeface="" />
                <a:font script="Jpan" typeface="游ゴシック Light" />
                <a:font script="Hang" typeface="맑은 고딕" />
                <a:font script="Hans" typeface="等线 Light" />
                <a:font script="Hant" typeface="新細明體" />
                <a:font script="Arab" typeface="Times New Roman" />
                <a:font script="Hebr" typeface="Times New Roman" />
                <a:font script="Thai" typeface="Tahoma" />
                <a:font script="Ethi" typeface="Nyala" />
                <a:font script="Beng" typeface="Vrinda" />
                <a:font script="Gujr" typeface="Shruti" />
                <a:font script="Khmr" typeface="MoolBoran" />
                <a:font script="Knda" typeface="Tunga" />
                <a:font script="Guru" typeface="Raavi" />
                <a:font script="Cans" typeface="Euphemia" />
                <a:font script="Cher" typeface="Plantagenet Cherokee" />
                <a:font script="Yiii" typeface="Microsoft Yi Baiti" />
                <a:font script="Tibt" typeface="Microsoft Himalaya" />
                <a:font script="Thaa" typeface="MV Boli" />
                <a:font script="Deva" typeface="Mangal" />
                <a:font script="Telu" typeface="Gautami" />
                <a:font script="Taml" typeface="Latha" />
                <a:font script="Syrc" typeface="Estrangelo Edessa" />
                <a:font script="Orya" typeface="Kalinga" />
                <a:font script="Mlym" typeface="Kartika" />
                <a:font script="Laoo" typeface="DokChampa" />
                <a:font script="Sinh" typeface="Iskoola Pota" />
                <a:font script="Mong" typeface="Mongolian Baiti" />
                <a:font script="Viet" typeface="Times New Roman" />
                <a:font script="Uigh" typeface="Microsoft Uighur" />
                <a:font script="Geor" typeface="Sylfaen" />
                <a:font script="Armn" typeface="Arial" />
                <a:font script="Bugi" typeface="Leelawadee UI" />
                <a:font script="Bopo" typeface="Microsoft JhengHei" />
                <a:font script="Java" typeface="Javanese Text" />
                <a:font script="Lisu" typeface="Segoe UI" />
                <a:font script="Mymr" typeface="Myanmar Text" />
                <a:font script="Nkoo" typeface="Ebrima" />
                <a:font script="Olck" typeface="Nirmala UI" />
                <a:font script="Osma" typeface="Ebrima" />
                <a:font script="Phag" typeface="Phagspa" />
                <a:font script="Syrn" typeface="Estrangelo Edessa" />
                <a:font script="Syrj" typeface="Estrangelo Edessa" />
                <a:font script="Syre" typeface="Estrangelo Edessa" />
                <a:font script="Sora" typeface="Nirmala UI" />
                <a:font script="Tale" typeface="Microsoft Tai Le" />
                <a:font script="Talu" typeface="Microsoft New Tai Lue" />
                <a:font script="Tfng" typeface="Ebrima" />
            </a:majorFont>
            <a:minorFont>
                <a:latin typeface="Aptos Narrow" panose="02110004020202020204" />
                <a:ea typeface="" />
                <a:cs typeface="" />
                <a:font script="Jpan" typeface="游ゴシック" />
                <a:font script="Hang" typeface="맑은 고딕" />
                <a:font script="Hans" typeface="等线" />
                <a:font script="Hant" typeface="新細明體" />
                <a:font script="Arab" typeface="Arial" />
                <a:font script="Hebr" typeface="Arial" />
                <a:font script="Thai" typeface="Tahoma" />
                <a:font script="Ethi" typeface="Nyala" />
                <a:font script="Beng" typeface="Vrinda" />
                <a:font script="Gujr" typeface="Shruti" />
                <a:font script="Khmr" typeface="DaunPenh" />
                <a:font script="Knda" typeface="Tunga" />
                <a:font script="Guru" typeface="Raavi" />
                <a:font script="Cans" typeface="Euphemia" />
                <a:font script="Cher" typeface="Plantagenet Cherokee" />
                <a:font script="Yiii" typeface="Microsoft Yi Baiti" />
                <a:font script="Tibt" typeface="Microsoft Himalaya" />
                <a:font script="Thaa" typeface="MV Boli" />
                <a:font script="Deva" typeface="Mangal" />
                <a:font script="Telu" typeface="Gautami" />
                <a:font script="Taml" typeface="Latha" />
                <a:font script="Syrc" typeface="Estrangelo Edessa" />
                <a:font script="Orya" typeface="Kalinga" />
                <a:font script="Mlym" typeface="Kartika" />
                <a:font script="Laoo" typeface="DokChampa" />
                <a:font script="Sinh" typeface="Iskoola Pota" />
                <a:font script="Mong" typeface="Mongolian Baiti" />
                <a:font script="Viet" typeface="Arial" />
                <a:font script="Uigh" typeface="Microsoft Uighur" />
                <a:font script="Geor" typeface="Sylfaen" />
                <a:font script="Armn" typeface="Arial" />
                <a:font script="Bugi" typeface="Leelawadee UI" />
                <a:font script="Bopo" typeface="Microsoft JhengHei" />
                <a:font script="Java" typeface="Javanese Text" />
                <a:font script="Lisu" typeface="Segoe UI" />
                <a:font script="Mymr" typeface="Myanmar Text" />
                <a:font script="Nkoo" typeface="Ebrima" />
                <a:font script="Olck" typeface="Nirmala UI" />
                <a:font script="Osma" typeface="Ebrima" />
                <a:font script="Phag" typeface="Phagspa" />
                <a:font script="Syrn" typeface="Estrangelo Edessa" />
                <a:font script="Syrj" typeface="Estrangelo Edessa" />
                <a:font script="Syre" typeface="Estrangelo Edessa" />
                <a:font script="Sora" typeface="Nirmala UI" />
                <a:font script="Tale" typeface="Microsoft Tai Le" />
                <a:font script="Talu" typeface="Microsoft New Tai Lue" />
                <a:font script="Tfng" typeface="Ebrima" />
            </a:minorFont>
        </a:fontScheme>
        <a:fmtScheme name="Office">
            <a:fillStyleLst>
                <a:solidFill>
                    <a:schemeClr val="phClr" />
                </a:solidFill>
                <a:gradFill rotWithShape="1">
                    <a:gsLst>
                        <a:gs pos="0">
                            <a:schemeClr val="phClr">
                                <a:lumMod val="110000" />
                                <a:satMod val="105000" />
                                <a:tint val="67000" />
                            </a:schemeClr>
                        </a:gs>
                        <a:gs pos="50000">
                            <a:schemeClr val="phClr">
                                <a:lumMod val="105000" />
                                <a:satMod val="103000" />
                                <a:tint val="73000" />
                            </a:schemeClr>
                        </a:gs>
                        <a:gs pos="100000">
                            <a:schemeClr val="phClr">
                                <a:lumMod val="105000" />
                                <a:satMod val="109000" />
                                <a:tint val="81000" />
                            </a:schemeClr>
                        </a:gs>
                    </a:gsLst>
                    <a:lin ang="5400000" scaled="0" />
                </a:gradFill>
                <a:gradFill rotWithShape="1">
                    <a:gsLst>
                        <a:gs pos="0">
                            <a:schemeClr val="phClr">
                                <a:satMod val="103000" />
                                <a:lumMod val="102000" />
                                <a:tint val="94000" />
                            </a:schemeClr>
                        </a:gs>
                        <a:gs pos="50000">
                            <a:schemeClr val="phClr">
                                <a:satMod val="110000" />
                                <a:lumMod val="100000" />
                                <a:shade val="100000" />
                            </a:schemeClr>
                        </a:gs>
                        <a:gs pos="100000">
                            <a:schemeClr val="phClr">
                                <a:lumMod val="99000" />
                                <a:satMod val="120000" />
                                <a:shade val="78000" />
                            </a:schemeClr>
                        </a:gs>
                    </a:gsLst>
                    <a:lin ang="5400000" scaled="0" />
                </a:gradFill>
            </a:fillStyleLst>
            <a:lnStyleLst>
                <a:ln w="12700" cap="flat" cmpd="sng" algn="ctr">
                    <a:solidFill>
                        <a:schemeClr val="phClr" />
                    </a:solidFill>
                    <a:prstDash val="solid" />
                    <a:miter lim="800000" />
                </a:ln>
                <a:ln w="19050" cap="flat" cmpd="sng" algn="ctr">
                    <a:solidFill>
                        <a:schemeClr val="phClr" />
                    </a:solidFill>
                    <a:prstDash val="solid" />
                    <a:miter lim="800000" />
                </a:ln>
                <a:ln w="25400" cap="flat" cmpd="sng" algn="ctr">
                    <a:solidFill>
                        <a:schemeClr val="phClr" />
                    </a:solidFill>
                    <a:prstDash val="solid" />
                    <a:miter lim="800000" />
                </a:ln>
            </a:lnStyleLst>
            <a:effectStyleLst>
                <a:effectStyle>
                    <a:effectLst />
                </a:effectStyle>
                <a:effectStyle>
                    <a:effectLst />
                </a:effectStyle>
                <a:effectStyle>
                    <a:effectLst>
                        <a:outerShdw blurRad="57150" dist="19050" dir="5400000" algn="ctr"
                            rotWithShape="0">
                            <a:srgbClr val="000000">
                                <a:alpha val="63000" />
                            </a:srgbClr>
                        </a:outerShdw>
                    </a:effectLst>
                </a:effectStyle>
            </a:effectStyleLst>
            <a:bgFillStyleLst>
                <a:solidFill>
                    <a:schemeClr val="phClr" />
                </a:solidFill>
                <a:solidFill>
                    <a:schemeClr val="phClr">
                        <a:tint val="95000" />
                        <a:satMod val="170000" />
                    </a:schemeClr>
                </a:solidFill>
                <a:gradFill rotWithShape="1">
                    <a:gsLst>
                        <a:gs pos="0">
                            <a:schemeClr val="phClr">
                                <a:tint val="93000" />
                                <a:satMod val="150000" />
                                <a:shade val="98000" />
                                <a:lumMod val="102000" />
                            </a:schemeClr>
                        </a:gs>
                        <a:gs pos="50000">
                            <a:schemeClr val="phClr">
                                <a:tint val="98000" />
                                <a:satMod val="130000" />
                                <a:shade val="90000" />
                                <a:lumMod val="103000" />
                            </a:schemeClr>
                        </a:gs>
                        <a:gs pos="100000">
                            <a:schemeClr val="phClr">
                                <a:shade val="63000" />
                                <a:satMod val="120000" />
                            </a:schemeClr>
                        </a:gs>
                    </a:gsLst>
                    <a:lin ang="5400000" scaled="0" />
                </a:gradFill>
            </a:bgFillStyleLst>
        </a:fmtScheme>
    </a:themeElements>
    <a:objectDefaults>
        <a:lnDef>
            <a:spPr />
            <a:bodyPr />
            <a:lstStyle />
            <a:style>
                <a:lnRef idx="2">
                    <a:schemeClr val="accent1" />
                </a:lnRef>
                <a:fillRef idx="0">
                    <a:schemeClr val="accent1" />
                </a:fillRef>
                <a:effectRef idx="1">
                    <a:schemeClr val="accent1" />
                </a:effectRef>
                <a:fontRef idx="minor">
                    <a:schemeClr val="tx1" />
                </a:fontRef>
            </a:style>
        </a:lnDef>
    </a:objectDefaults>
    <a:extraClrSchemeLst />
    <a:extLst>
        <a:ext uri="{05A4C25C-085E-4340-85A3-A5531E510DB2}">
            <thm15:themeFamily xmlns:thm15="http://schemas.microsoft.com/office/thememl/2012/main"
                name="Office Theme" id="{2E142A2C-CD16-42D6-873A-C26D2A0506FA}"
                vid="{1BDDFF52-6CD6-40A5-AB3C-68EB2F1E4D0A}" />
        </a:ext>
    </a:extLst>
</a:theme>`);

        await super.close();
    }
}

