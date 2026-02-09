' ME22N - Modificar Pedido de Compra
' Script para abrir a transação ME22N no SAP GUI
' Uso: cscript //nologo me22n_modificar_pedido.vbs "4500012345"

On Error Resume Next

' Pegar número do pedido do argumento
If WScript.Arguments.Count > 0 Then
    orderNumber = WScript.Arguments(0)
Else
    WScript.Echo "Erro: Número do pedido não informado"
    WScript.Quit 1
End If

' Conectar ao SAP GUI
Set SapGuiAuto = GetObject("SAPGUI")
If Err.Number <> 0 Then
    WScript.Echo "Erro: SAP GUI não está aberto"
    WScript.Quit 1
End If

Set application = SapGuiAuto.GetScriptingEngine
If application Is Nothing Then
    WScript.Echo "Erro: Não foi possível conectar ao SAP GUI"
    WScript.Quit 1
End If

If application.Children.Count = 0 Then
    WScript.Echo "Erro: Nenhuma conexão SAP ativa"
    WScript.Quit 1
End If

Set connection = application.Children(0)
If connection.Children.Count = 0 Then
    WScript.Echo "Erro: Nenhuma sessão SAP ativa"
    WScript.Quit 1
End If

Set session = connection.Children(0)

' Executar transação ME22N
session.findById("wnd[0]/tbar[0]/okcd").text = "/nME22N"
session.findById("wnd[0]").sendVKey 0

' Aguardar tela carregar
WScript.Sleep 500

' Inserir número do pedido
On Error Resume Next
session.findById("wnd[0]/usr/subSUB0:SAPLMEGUI:0013/subSUB1:SAPLMEVIEWS:1100/subSUB2:SAPLMEVIEWS:1200/subSUB1:SAPLMEGUI:1102/tabsHEADER_DETAIL/tabpTABHDT1/ssubTABSTRIPCONTROL1SUB:SAPLMEGUI:1221/ctxtMEPO_TOPLINE-BEESSION_SCREEN_EBELN").text = orderNumber
If Err.Number <> 0 Then
    ' Tentar outro caminho comum
    Err.Clear
    session.findById("wnd[0]/usr/ctxtRM06E-BSTNR").text = orderNumber
End If

session.findById("wnd[0]").sendVKey 0

If Err.Number <> 0 Then
    WScript.Echo "Transação ME22N aberta. Insira o pedido manualmente: " & orderNumber
Else
    WScript.Echo "Pedido " & orderNumber & " aberto para modificação"
End If
